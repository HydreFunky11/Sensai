import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar/Navbar';
import { 
  getAdminStats, 
  getAdminUsers, 
  createAdminUser, 
  toggleAdminUserPremium, 
  resetAdminUserPassword, 
  deleteAdminUser,
  getMe 
} from '../../api/client';
import { toast } from 'react-hot-toast';
import './Admin.css';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulaire d'ajout testeur
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsPremium, setNewIsPremium] = useState(true);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastCreatedCreds, setLastCreatedCreds] = useState(null);

  // Filtre recherche
  const [searchQuery, setSearchQuery] = useState('');

  // Modale Reset Mot de passe
  const [resetModalUser, setResetModalUser] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [statsData, usersData, meData] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getMe()
      ]);
      setStats(statsData);
      setUsers(usersData);
      setCurrentUser(meData);
    } catch (err) {
      toast.error(err.message || "Erreur lors du chargement des données admin");
    } finally {
      setLoading(false);
    }
  }

  // Générateur de mot de passe fort
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
  };

  // Création d'un testeur / utilisateur
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) {
      toast.error("Veuillez renseigner un email et un mot de passe.");
      return;
    }

    setCreating(true);
    try {
      const created = await createAdminUser({
        email: newEmail.trim(),
        password: newPassword.trim(),
        is_premium: newIsPremium,
        is_admin: newIsAdmin
      });

      setLastCreatedCreds({
        email: created.email,
        password: newPassword.trim(),
        isPremium: created.is_premium
      });

      toast.success(`Compte testeur créé avec succès pour ${created.email} !`);
      setNewEmail('');
      setNewPassword('');
      await loadAdminData();
    } catch (err) {
      toast.error(err.message || "Impossible de créer l'utilisateur");
    } finally {
      setCreating(false);
    }
  };

  // Copie des identifiants dans le presse-papier
  const handleCopyCreds = () => {
    if (!lastCreatedCreds) return;
    const text = `Identifiants SensAI :\nEmail: ${lastCreatedCreds.email}\nMot de passe: ${lastCreatedCreds.password}\nURL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    toast.success("Identifiants copiés dans le presse-papier !");
  };

  // Bascule statut Premium
  const handleTogglePremium = async (user) => {
    try {
      const updated = await toggleAdminUserPremium(user.id, !user.is_premium);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_premium: updated.is_premium } : u));
      toast.success(`Statut Premium ${updated.is_premium ? 'activé' : 'désactivé'} pour ${user.email}`);
      getAdminStats().then(setStats).catch(() => {});
    } catch (err) {
      toast.error(err.message || "Erreur mise à jour Premium");
    }
  };

  // Réinitialiser le mot de passe
  const submitResetPassword = async () => {
    if (!resetPasswordVal || resetPasswordVal.length < 4) {
      toast.error("Le mot de passe doit comporter au moins 4 caractères.");
      return;
    }

    setResetting(true);
    try {
      await resetAdminUserPassword(resetModalUser.id, resetPasswordVal);
      toast.success(`Mot de passe réinitialisé avec succès pour ${resetModalUser.email} !`);
      setResetModalUser(null);
      setResetPasswordVal('');
    } catch (err) {
      toast.error(err.message || "Erreur réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  // Suppression utilisateur
  const handleDeleteUser = async (user) => {
    if (window.confirm(`Confirmez-vous la suppression définitive du compte ${user.email} ? Ses données seront effacées.`)) {
      try {
        await deleteAdminUser(user.id);
        toast.success(`Compte ${user.email} supprimé.`);
        await loadAdminData();
      } catch (err) {
        toast.error(err.message || "Erreur suppression utilisateur");
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-page-container">
      <Navbar />

      <main className="admin-content">
        {/* Header */}
        <header className="admin-header">
          <div className="admin-title-group">
            <h1>🛡️ Panneau d'Administration</h1>
            <p className="admin-subtitle">
              Gestion de la bêta privée, invitation des testeurs et vue d'ensemble du système SensAI.
            </p>
          </div>
          <span className="admin-badge-role">
            Mode Administrateur Connecté ({currentUser?.email})
          </span>
        </header>

        {/* Global Statistics Cards */}
        {stats && (
          <section className="admin-stats-grid" aria-label="Statistiques globales">
            <div className="admin-stat-card">
              <div className="admin-stat-icon">👥</div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats.total_users}</span>
                <span className="admin-stat-label">
                  Utilisateurs ({stats.total_testers} testeurs, {stats.total_admins} admin)
                </span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon">👑</div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats.total_premium}</span>
                <span className="admin-stat-label">Comptes Premium Actifs</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon">📚</div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats.total_mangas}</span>
                <span className="admin-stat-label">Mangas dans les Bibliothèques</span>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-icon">🧠</div>
              <div className="admin-stat-info">
                <span className="admin-stat-val">{stats.total_cards}</span>
                <span className="admin-stat-label">Fiches Anki Générées</span>
              </div>
            </div>
          </section>
        )}

        {/* Add Tester / User Form */}
        <section className="admin-section-card" aria-labelledby="add-tester-title">
          <h2 id="add-tester-title" className="admin-section-title">
            <span>➕</span> Créer un compte testeur
          </h2>

          <form onSubmit={handleCreateUser} className="admin-create-form">
            <div className="admin-form-group">
              <label htmlFor="tester-email">Email du testeur</label>
              <input
                id="tester-email"
                type="email"
                placeholder="testeur@exemple.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="admin-input"
                required
              />
            </div>

            <div className="admin-form-group">
              <label htmlFor="tester-password">Mot de passe provisoire</label>
              <div className="admin-input-row">
                <input
                  id="tester-password"
                  type="text"
                  placeholder="Mot de passe ou généré"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="admin-input"
                  required
                />
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="admin-btn-secondary"
                  title="Générer un mot de passe aléatoire sécurisé"
                >
                  🎲 Générer
                </button>
              </div>
            </div>

            <div className="admin-form-group">
              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newIsPremium}
                    onChange={(e) => setNewIsPremium(e.target.checked)}
                  />
                  👑 Statut Premium immédiat
                </label>
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                  />
                  🛡️ Droit Administrateur
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="admin-btn-primary"
            >
              {creating ? 'Création en cours...' : '🚀 Créer le compte'}
            </button>
          </form>

          {/* Feedback des derniers identifiants créés */}
          {lastCreatedCreds && (
            <div className="admin-success-box" role="status" aria-live="polite">
              <div className="admin-success-details">
                ✨ Compte prêt ! <strong>{lastCreatedCreds.email}</strong> | Mot de passe : <strong>{lastCreatedCreds.password}</strong>
              </div>
              <button
                type="button"
                onClick={handleCopyCreds}
                className="admin-btn-secondary"
              >
                📋 Copier le message d'accès pour le testeur
              </button>
            </div>
          )}
        </section>

        {/* Users / Testers List */}
        <section className="admin-section-card" aria-labelledby="users-list-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 id="users-list-title" className="admin-section-title" style={{ margin: 0 }}>
              <span>👥</span> Liste des comptes enregistrés ({filteredUsers.length})
            </h2>

            <input
              type="search"
              placeholder="🔍 Filtrer par email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input"
              style={{ maxWidth: '280px' }}
              aria-label="Filtrer les utilisateurs"
            />
          </div>

          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Abonnement</th>
                  <th>Activité</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Aucun compte correspondant.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>
                          <strong>{u.email}</strong>
                          {isSelf && <span style={{ color: '#f59e0b', fontSize: '0.75rem', marginLeft: '6px' }}>(Vous)</span>}
                        </td>
                        <td>
                          {u.is_admin ? (
                            <span className="admin-badge admin-badge-admin">🛡️ Admin</span>
                          ) : (
                            <span className="admin-badge admin-badge-tester">🧪 Testeur</span>
                          )}
                        </td>
                        <td>
                          {u.is_premium ? (
                            <span className="admin-badge admin-badge-premium">👑 Premium</span>
                          ) : (
                            <span className="admin-badge admin-badge-free">Standard</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {u.flashcards_count} carte(s) · {u.mangas_count} manga(s)
                          </span>
                        </td>
                        <td>
                          <div className="admin-actions-cell">
                            <button
                              type="button"
                              onClick={() => handleTogglePremium(u)}
                              className="admin-action-btn"
                              title={u.is_premium ? "Rétrograder en Standard" : "Promouvoir en Premium"}
                            >
                              {u.is_premium ? "Retirer VIP" : "Passer VIP"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalUser(u);
                                setResetPasswordVal('');
                              }}
                              className="admin-action-btn"
                              title="Réinitialiser le mot de passe"
                            >
                              🔑 Reset MdP
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              disabled={isSelf}
                              className="admin-action-btn admin-action-btn-danger"
                              title={isSelf ? "Impossible de supprimer votre propre compte" : "Supprimer ce compte"}
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Modal Réinitialisation Mot de passe */}
      {resetModalUser && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <div className="admin-modal">
            <h3 id="reset-modal-title" className="admin-modal-title">
              🔑 Réinitialiser le mot de passe
            </h3>
            <p className="admin-modal-desc">
              Définir un nouveau mot de passe pour <strong>{resetModalUser.email}</strong>.
            </p>

            <div className="admin-form-group">
              <label htmlFor="modal-new-pwd">Nouveau mot de passe</label>
              <div className="admin-input-row">
                <input
                  id="modal-new-pwd"
                  type="text"
                  placeholder="Min. 4 caractères"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="admin-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
                    let pwd = '';
                    for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                    setResetPasswordVal(pwd);
                  }}
                  className="admin-btn-secondary"
                >
                  🎲 Aléatoire
                </button>
              </div>
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="admin-btn-secondary"
                disabled={resetting}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitResetPassword}
                disabled={resetting}
                className="admin-btn-primary"
              >
                {resetting ? 'Enregistrement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
