import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🛡️</div>
        <h2 style={styles.title}>Bêta Privée sur Invitation</h2>
        <p style={styles.subtitle}>
          Les inscriptions publiques sont temporairement fermées afin de garantir la qualité et la stabilité des modèles d'IA.
        </p>

        <div style={styles.infoBox}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>
            Pour tester SensAI, veuillez demander la création d'un compte directement auprès de l'administrateur.
          </p>
        </div>

        <button
          onClick={() => navigate('/login')}
          style={styles.primaryBtn}
        >
          🔑 Se connecter à mon compte
        </button>

        <p style={{ marginTop: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
          Déjà testeur ? <Link to="/login" style={{ color: '#38bdf8', fontWeight: 'bold' }}>Connexion</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    width: '100vw',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '20px',
    boxSizing: 'border-box'
  },
  card: {
    background: '#1e293b',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    width: '100%',
    maxWidth: '460px',
    textAlign: 'center',
    border: '1px solid #334155'
  },
  icon: {
    fontSize: '3.5rem',
    marginBottom: '16px'
  },
  title: {
    margin: '0 0 10px',
    color: '#f8fafc',
    fontSize: '24px',
    fontWeight: '800'
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: '24px',
    fontSize: '0.95rem',
    lineHeight: '1.5'
  },
  infoBox: {
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '28px',
    textAlign: 'left'
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
    transition: 'transform 0.2s'
  }
};
