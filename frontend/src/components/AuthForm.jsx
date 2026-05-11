import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const PASSWORD_HINT =
  '12 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial (! @ # ? % & *).';

function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 12) return false;
  return (
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#?%&*]/.test(password)
  );
}

export default function AuthForm({ mode, footer }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: '',
  });
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { title } = useMemo(
    () => ({
      title: isRegister ? 'Inscription' : 'Connexion',
    }),
    [isRegister],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (isRegister && !isStrongPassword(form.mot_de_passe)) {
      setIsSubmitting(false);
      setMessage({
        type: 'error',
        text: PASSWORD_HINT,
      });
      return;
    }

    try {
      const payload = isRegister
        ? {
            nom: form.nom.trim(),
            prenom: form.prenom.trim(),
            email: form.email.trim(),
            mot_de_passe: form.mot_de_passe,
          }
        : {
            email: form.email.trim(),
            mot_de_passe: form.mot_de_passe,
          };

      const data = isRegister ? await register(payload) : await login(payload);

      setMessage({
        type: 'success',
        text: data.message || (isRegister ? 'Inscription réussie.' : 'Connexion réussie.'),
        detail: !isRegister
          ? ((data.utilisateur?.prenom || data.utilisateur?.nom || data.utilisateur?.email)
            ? `Bienvenue ${data.utilisateur?.prenom || data.utilisateur?.nom || data.utilisateur?.email}!`
            : null)
          : 'Un email de confirmation vous a été envoyé.',
      });

      setForm((prev) => ({
        ...prev,
        mot_de_passe: '',
        ...(isRegister ? { email: '', nom: '', prenom: '' } : {}),
      }));

      if (!isRegister) {
        const redirectPath = location.state?.from || '/dashboard';
        navigate(redirectPath, { replace: true });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Impossible de traiter la requête.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegister && (
          <div className="field-row">
            <label htmlFor="nom">Nom</label>
            <input
              id="nom"
              name="nom"
              type="text"
              value={form.nom}
              onChange={handleChange}
              placeholder="Dupont"
            />
          </div>
        )}
        {isRegister && (
          <div className="field-row">
            <label htmlFor="prenom">Prénom</label>
            <input
              id="prenom"
              name="prenom"
              type="text"
              value={form.prenom}
              onChange={handleChange}
              placeholder="Marie"
            />
          </div>
        )}
        <div className="field-row">
          <label htmlFor={`${mode}-email`}>Adresse email</label>
          <input
            id={`${mode}-email`}
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="vous@exemple.com"
          />
        </div>
        <div className="field-row">
          <label htmlFor={`${mode}-mot-de-passe`}>
            Mot de passe {!isRegister && <span className="link-inline">Mot de passe oublié ?</span>}
          </label>
          <input
            id={`${mode}-mot-de-passe`}
            name="mot_de_passe"
            type="password"
            value={form.mot_de_passe}
            onChange={handleChange}
            required
            placeholder="••••••••••••••"
          />
          {isRegister && <p className="field-hint">{PASSWORD_HINT}</p>}
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'En cours...' : title}
        </button>
        {message && (
          <p className={`feedback ${message.type}`}>
            {message.text}
            {message.detail ? ` ${message.detail}` : ''}
          </p>
        )}
      </form>
      {footer && <div className="auth-footer">{footer}</div>}
    </section>
  );
}
