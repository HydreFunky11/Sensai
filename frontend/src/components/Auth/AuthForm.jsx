import React from 'react';
import { Link } from 'react-router-dom';

export default function AuthForm({ 
  title, 
  subtitle, 
  buttonText, 
  onSubmit, 
  loading, 
  error, 
  linkText, 
  linkPath,
  email,
  setEmail,
  password,
  setPassword
}) {
  return (
    <div style={styles.container}>
      <form onSubmit={onSubmit} style={styles.form}>
        <h2 style={styles.title}>{title}</h2>
        <p style={styles.subtitle}>{subtitle}</p>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <div style={styles.inputGroup}>
          <label style={styles.label}>Adresse Email</label>
          <input
            type="email"
            placeholder="exemple@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Mot de passe</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
          />
        </div>

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Traitement...' : buttonText}
        </button>
        
        <p style={styles.text}>
          {linkText} <Link to={linkPath} style={styles.link}>Cliquer ici</Link>
        </p>
      </form>
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
    background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
  },
  form: {
    background: 'white',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    width: '90%',
    maxWidth: '450px',
    textAlign: 'center',
  },
  title: { 
    margin: '0 0 10px', 
    color: '#2c3e50',
    fontSize: '28px',
    fontWeight: 'bold'
  },
  subtitle: {
    color: '#7f8c8d',
    marginBottom: '30px',
    fontSize: '16px'
  },
  error: { 
    color: '#e74c3c', 
    background: '#fadbd8',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  inputGroup: {
    textAlign: 'left',
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: '#34495e',
    fontWeight: '600',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '12px 15px',
    border: '2px solid #ecf0f1',
    borderRadius: '8px',
    boxSizing: 'border-box',
    fontSize: '16px',
    transition: 'border-color 0.3s',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: 'bold',
    transition: 'background 0.3s',
    marginTop: '10px'
  },
  text: { marginTop: '25px', color: '#7f8c8d', fontSize: '14px' },
  link: { color: '#3498db', textDecoration: 'none', fontWeight: 'bold' },
};
