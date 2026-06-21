import React, { useEffect, useState } from 'react';
import { getMe, updateProfile, createCheckoutSession, createPortalSession } from '../../api/client';
import { Navbar } from '../../components/Navbar/Navbar';
import { toast } from 'react-hot-toast';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function loadUser() {
    try {
      const data = await getMe();
      setUser(data);
      setEmail(data.email);
    } catch (err) {
      toast.error("Impossible de charger les informations de profil");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("L'adresse email ne peut pas être vide");
      return;
    }

    if (password) {
      if (password.length < 6) {
        toast.error("Le mot de passe doit faire au moins 6 caractères");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Les mots de passe ne correspondent pas");
        return;
      }
    }

    setSaving(true);
    try {
      const updateData = { email: email.trim() };
      if (password) {
        updateData.password = password;
      }

      await updateProfile(updateData);
      toast.success("Profil mis à jour avec succès !");
      setPassword('');
      setConfirmPassword('');
      loadUser();
    } catch (err) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const data = await createCheckoutSession();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setCheckoutLoading(true);
    try {
      const data = await createPortalSession();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <Navbar />
        <div style={styles.center}>Chargement du profil...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Navbar />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>👤 Mon Profil</h1>
          <p style={styles.subTitle}>Gérez vos identifiants et votre abonnement SensAI.</p>
        </div>

        {/* Section 1 : Informations personnelles */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>🔑 Informations de connexion</h2>
          <form onSubmit={handleSaveProfile} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Adresse Email</label>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                placeholder="nom@exemple.com"
                required
              />
            </div>
            
            <div style={styles.row}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Nouveau mot de passe (optionnel)</label>
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="••••••••"
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Confirmer le mot de passe</label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={saving} style={styles.btnSave}>
              {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
            </button>
          </form>
        </div>

        {/* Section 2 : Abonnement Stripe */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>💳 Mon Abonnement</h2>
          <div style={styles.billingSection}>
            <div style={styles.billingDetails}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={user?.is_premium ? styles.premiumBadge : styles.freeBadge}>
                  {user?.is_premium ? "👑 Premium Actif" : "⚡ Compte Gratuit"}
                </span>
              </div>
              <p style={styles.billingText}>
                {user?.is_premium 
                  ? "Merci pour votre abonnement ! Vous bénéficiez de toutes les fonctionnalités de SensAI en illimité." 
                  : "Le compte gratuit est limité à 20 analyses toutes les 6 heures, 5 dossiers de révision, et 15 cartes par dossier."}
              </p>
            </div>
            
            <button 
              onClick={user?.is_premium ? handlePortal : handleCheckout} 
              disabled={checkoutLoading} 
              style={user?.is_premium ? styles.btnPortal : styles.btnUpgrade}
            >
              {checkoutLoading ? "Chargement..." : (user?.is_premium ? "⚙️ Gérer mon abonnement" : "👑 Passer à Premium (9.99€/mois)")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121212',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  contentWrapper: {
    padding: '40px 20px',
    maxWidth: '700px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '1.2rem'
  },
  header: {
    marginBottom: '10px'
  },
  pageTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 8px 0'
  },
  subTitle: {
    fontSize: '1.05rem',
    color: '#94a3b8',
    margin: 0
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: '16px',
    padding: '28px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    border: '1px solid #2d2d2d'
  },
  sectionTitle: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 20px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  row: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
    minWidth: '240px'
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#cbd5e1'
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #3f3f3f',
    background: '#2c2c2c',
    color: 'white',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    width: '100%',
    ':focus': {
      borderColor: '#2563eb'
    }
  },
  btnSave: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    outline: 'none',
    marginTop: '10px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
  },
  billingSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '30px',
    flexWrap: 'wrap'
  },
  billingDetails: {
    flex: 1,
    minWidth: '280px'
  },
  billingText: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#cbd5e1',
    lineHeight: '1.5'
  },
  premiumBadge: {
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '0.85rem',
    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
  },
  freeBadge: {
    background: '#3f3f3f',
    color: '#cbd5e1',
    padding: '6px 12px',
    borderRadius: '20px',
    fontWeight: '700',
    fontSize: '0.85rem'
  },
  btnUpgrade: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  btnPortal: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #8b5cf6',
    color: '#c084fc',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    outline: 'none'
  }
};
