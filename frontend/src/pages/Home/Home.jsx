import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLibrary, importToLibrary, getLibraryFolders, createLibraryFolder, renameLibraryFolder, deleteLibraryFolder, moveMangaToFolder, renameManga, deleteManga } from '../../api/client';
import { Navbar } from '../../components/Navbar/Navbar';
import { toast } from 'react-hot-toast';

export default function Home() {
  const [library, setLibrary] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  
  const [sortBy, setSortBy] = useState('date');
  const [order, setOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // States for options menus
  const [activeMangaId, setActiveMangaId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);

  // States for Modals
  const [renameModal, setRenameModal] = useState({ isOpen: false, manga: null, title: '' });
  const [moveModal, setMoveModal] = useState({ isOpen: false, manga: null, targetFolderId: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, manga: null });
  
  const [renameFolderModal, setRenameFolderModal] = useState({ isOpen: false, folder: null, name: '' });
  const [deleteFolderModal, setDeleteFolderModal] = useState({ isOpen: false, folder: null });
  
  // State pour la modale d'importation de manga (titre personnalisé + découpe PDF)
  const [importModal, setImportModal] = useState({
    isOpen: false,
    file: null,
    title: '',
    isPdf: false,
    isSplitRange: false,
    pageStart: '',
    pageEnd: ''
  });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    loadLibrary(selectedFolderId, sortBy, order);
  }, [selectedFolderId, sortBy, order]);

  async function init() {
    try {
      const f = await getLibraryFolders();
      setFolders(f);
    } catch (e) {
      console.error("Erreur folders", e);
    }
  }

  async function loadLibrary(folderId, sortMethod = sortBy, sortOrder = order) {
    setLoading(true);
    try {
      const data = await getLibrary(folderId, sortMethod, sortOrder);
      setLibrary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createLibraryFolder(newFolderName);
      setNewFolderName('');
      await init();
      toast.success("Dossier créé avec succès !");
    } catch(e) {
      toast.error("Erreur création dossier");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    // Titre par défaut sans extension
    const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

    setImportModal({
      isOpen: true,
      file: file,
      title: cleanTitle,
      isPdf: isPdf,
      isSplitRange: false,
      pageStart: '',
      pageEnd: ''
    });
  };

  const submitImport = async () => {
    const { file, title, isSplitRange, pageStart, pageEnd } = importModal;
    if (!file) return;

    setImportModal(prev => ({ ...prev, isOpen: false }));
    setImporting(true);

    try {
      const pStart = isSplitRange && pageStart !== '' ? parseInt(pageStart, 10) : null;
      const pEnd = isSplitRange && pageEnd !== '' ? parseInt(pageEnd, 10) : null;

      await importToLibrary(file, selectedFolderId, title, pStart, pEnd);
      await loadLibrary(selectedFolderId, sortBy, order);
      toast.success("Document importé avec succès !");
    } catch (err) {
      toast.error("Erreur lors de l'import: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openReader = (manga) => {
    navigate('/reader', { state: { manga } });
  };

  // --- ACTIONS MODALES MANGAS ---
  
  const openRenameModal = (e, manga) => {
    e.stopPropagation();
    setRenameModal({ isOpen: true, manga: manga, title: manga.title });
    setActiveMangaId(null);
  };

  const submitRename = async () => {
    if (!renameModal.title.trim() || !renameModal.manga) return;
    try {
      await renameManga(renameModal.manga.id, renameModal.title.trim());
      await loadLibrary(selectedFolderId, sortBy, order);
      setRenameModal({ isOpen: false, manga: null, title: '' });
      toast.success("Document renommé !");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDeleteModal = (e, manga) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, manga: manga });
    setActiveMangaId(null);
  };

  const submitDelete = async () => {
    if (!deleteModal.manga) return;
    try {
      await deleteManga(deleteModal.manga.id);
      await loadLibrary(selectedFolderId, sortBy, order);
      setDeleteModal({ isOpen: false, manga: null });
      toast.success("Document supprimé !");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openMoveModal = (e, manga) => {
    e.stopPropagation();
    setMoveModal({ isOpen: true, manga: manga, targetFolderId: manga.folder_id || '' });
    setActiveMangaId(null);
  };

  const submitMove = async () => {
    if (!moveModal.manga) return;
    const folderId = moveModal.targetFolderId === '' ? null : parseInt(moveModal.targetFolderId);
    try {
      await moveMangaToFolder(moveModal.manga.id, folderId);
      await loadLibrary(selectedFolderId, sortBy, order);
      setMoveModal({ isOpen: false, manga: null, targetFolderId: '' });
      toast.success("Document déplacé avec succès !");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleMenu = (e, mangaId) => {
    e.stopPropagation();
    setActiveMangaId(activeMangaId === mangaId ? null : mangaId);
    setActiveFolderId(null);
  };

  // --- ACTIONS MODALES DOSSIERS ---

  const toggleFolderMenu = (e, folderId) => {
    e.stopPropagation();
    setActiveFolderId(activeFolderId === folderId ? null : folderId);
    setActiveMangaId(null);
  };

  const openRenameFolderModal = (e, folder) => {
    e.stopPropagation();
    setRenameFolderModal({ isOpen: true, folder: folder, name: folder.name });
    setActiveFolderId(null);
  };

  const submitRenameFolder = async () => {
    if (!renameFolderModal.name.trim() || !renameFolderModal.folder) return;
    try {
      await renameLibraryFolder(renameFolderModal.folder.id, renameFolderModal.name.trim());
      await init();
      setRenameFolderModal({ isOpen: false, folder: null, name: '' });
      toast.success("Dossier renommé !");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDeleteFolderModal = (e, folder) => {
    e.stopPropagation();
    setDeleteFolderModal({ isOpen: true, folder: folder });
    setActiveFolderId(null);
  };

  const submitDeleteFolder = async () => {
    if (!deleteFolderModal.folder) return;
    try {
      await deleteLibraryFolder(deleteFolderModal.folder.id);
      if (selectedFolderId === deleteFolderModal.folder.id) {
        setSelectedFolderId(null);
      } else {
        await loadLibrary(selectedFolderId, sortBy, order);
      }
      await init();
      setDeleteFolderModal({ isOpen: false, folder: null });
      toast.success("Dossier supprimé !");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const closeAllMenus = () => {
    setActiveMangaId(null);
    setActiveFolderId(null);
  };

  return (
    <div style={styles.container} onClick={closeAllMenus}>
      <Navbar 
        onImportClick={() => fileInputRef.current?.click()} 
        importing={importing} 
      />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*,.pdf" 
            aria-hidden="true"
          />
      
      <div style={styles.layout}>
        {/* SIDEBAR DOSSIERS */}
        <aside style={styles.sidebar} aria-label="Liste des dossiers">
          <h3 style={{ color: '#bdc3c7', marginTop: 0 }}>Dossiers</h3>
          <ul style={styles.folderList} role="tablist" aria-orientation="vertical">
            <li 
              role="tab"
              aria-selected={selectedFolderId === null}
              tabIndex="0"
              style={{...styles.folderItem, background: selectedFolderId === null ? '#34495e' : 'transparent'}}
              onClick={() => setSelectedFolderId(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedFolderId(null); }}
            >
              📁 Tous
            </li>
            {folders.map(f => (
              <li 
                key={f.id} 
                role="tab"
                aria-selected={selectedFolderId === f.id}
                tabIndex="0"
                style={{...styles.folderItem, background: selectedFolderId === f.id ? '#34495e' : 'transparent', position: 'relative'}}
                onClick={() => setSelectedFolderId(f.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedFolderId(f.id); }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📁 {f.name}</span>
                  <button 
                    onClick={(e) => toggleFolderMenu(e, f.id)} 
                    aria-label={`Options pour le dossier ${f.name}`}
                    aria-haspopup="true"
                    aria-expanded={activeFolderId === f.id}
                    style={styles.folderOptionsBtn}
                  >
                    ⋮
                  </button>
                </div>
                
                {/* Menu Options Dossier */}
                {activeFolderId === f.id && (
                  <div style={styles.folderOptionsMenu} role="menu">
                    <button role="menuitem" onClick={(e) => openRenameFolderModal(e, f)} style={styles.menuItem}>Renommer</button>
                    <button role="menuitem" onClick={(e) => openDeleteFolderModal(e, f)} style={{...styles.menuItem, color: '#e74c3c'}}>Supprimer</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <input 
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nouveau dossier..."
              aria-label="Nom du nouveau dossier"
              style={styles.folderInput}
            />
            <button onClick={handleCreateFolder} style={styles.folderAddBtn}>+ Ajouter</button>
          </div>
        </aside>

        {/* MAIN LIBRARY GRID */}
        <main style={styles.main} aria-label="Contenu de la bibliothèque">
          <div style={styles.toolbar}>
             <div style={styles.sortControls}>
               <label htmlFor="sort-select" style={{ color: '#bdc3c7', fontSize: '0.9rem' }}>Trier par :</label>
               <select 
                id="sort-select"
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)} 
                style={styles.sortSelect}
               >
                 <option value="date">Date d'ajout</option>
                 <option value="name">Titre</option>
               </select>
               <button 
                onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')} 
                aria-label={`Ordre ${order === 'asc' ? 'décroissant' : 'croissant'}`}
                style={styles.sortBtn}
               >
                 {order === 'asc' ? '⬆️ Asc' : '⬇️ Desc'}
               </button>
             </div>
          </div>
          
          {loading ? (
            <div style={styles.center} role="status">Chargement de la bibliothèque...</div>
          ) : library.length === 0 ? (
            <div style={styles.center}>
              <h2>Dossier vide</h2>
              <p>Cliquez sur "Importer Ici" pour ajouter votre premier manga ou document PDF.</p>
            </div>
          ) : (
            <div style={styles.grid} role="list">
              {library.map(manga => (
                <div 
                  key={manga.id} 
                  style={styles.mangaCard} 
                  onClick={() => openReader(manga)}
                  role="listitem"
                  tabIndex="0"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openReader(manga); }}
                >
                  <div style={styles.coverPlaceholder}>
                    {manga.cover_image ? (
                      <img src={manga.cover_image} alt={`Couverture de ${manga.title}`} style={styles.coverImg} loading="lazy" />
                    ) : (
                      <span style={styles.coverText} aria-hidden="true">{manga.title[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div style={styles.mangaTitleWrapper}>
                    <h3 style={styles.mangaTitle}>{manga.title}</h3>
                    <button 
                      onClick={(e) => toggleMenu(e, manga.id)} 
                      aria-label={`Options pour ${manga.title}`}
                      aria-haspopup="true"
                      aria-expanded={activeMangaId === manga.id}
                      style={styles.optionsBtn}
                    >
                      ⋮
                    </button>
                  </div>
                  
                  {/* Menu Options Manga */}
                  {activeMangaId === manga.id && (
                    <div style={styles.optionsMenu} role="menu">
                      <button role="menuitem" onClick={(e) => openRenameModal(e, manga)} style={styles.menuItem}>Renommer</button>
                      <button role="menuitem" onClick={(e) => openMoveModal(e, manga)} style={styles.menuItem}>Déplacer</button>
                      <button role="menuitem" onClick={(e) => openDeleteModal(e, manga)} style={{...styles.menuItem, color: '#e74c3c'}}>Supprimer</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {renameModal.isOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-rename-title" onClick={() => setRenameModal({ isOpen: false, manga: null, title: '' })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 id="modal-rename-title" style={{ marginTop: 0, color: '#2c3e50' }}>Renommer l'œuvre</h3>
            <label htmlFor="rename-input" style={{ display: 'none' }}>Nouveau titre</label>
            <input 
              id="rename-input"
              type="text" 
              value={renameModal.title} 
              onChange={e => setRenameModal({ ...renameModal, title: e.target.value })}
              style={styles.modalInput}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setRenameModal({ isOpen: false, manga: null, title: '' })} style={styles.btnCancel}>Annuler</button>
              <button onClick={submitRename} style={styles.btnSave}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DÉPLACEMENT MANGA */}
      {moveModal.isOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-move-title" onClick={() => setMoveModal({ isOpen: false, manga: null, targetFolderId: '' })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 id="modal-move-title" style={{ marginTop: 0, color: '#2c3e50' }}>Déplacer l'œuvre</h3>
            <p id="move-desc" style={{ color: '#7f8c8d', marginBottom: '15px' }}>Où souhaitez-vous ranger "{moveModal.manga?.title}" ?</p>
            <label htmlFor="move-select" style={{ display: 'none' }}>Choisir un dossier</label>
            <select 
              id="move-select"
              value={moveModal.targetFolderId} 
              onChange={e => setMoveModal({ ...moveModal, targetFolderId: e.target.value })}
              aria-describedby="move-desc"
              style={styles.modalInput}
            >
              <option value="">📁 Tous (Racine)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>📁 {f.name}</option>
              ))}
            </select>
            <div style={styles.modalActions}>
              <button onClick={() => setMoveModal({ isOpen: false, manga: null, targetFolderId: '' })} style={styles.btnCancel}>Annuler</button>
              <button onClick={submitMove} style={styles.btnSave}>Déplacer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SUPPRESSION MANGA */}
      {deleteModal.isOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-delete-title" onClick={() => setDeleteModal({ isOpen: false, manga: null })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 id="modal-delete-title" style={{ marginTop: 0, color: '#e74c3c' }}>Supprimer l'œuvre</h3>
            <div id="delete-desc">
              <p style={{ color: '#2c3e50' }}>Voulez-vous vraiment supprimer définitivement <strong>{deleteModal.manga?.title}</strong> ?</p>
              <p style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '20px' }}>Cette action supprimera également le fichier du serveur.</p>
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setDeleteModal({ isOpen: false, manga: null })} style={styles.btnCancel}>Annuler</button>
              <button onClick={submitDelete} aria-describedby="delete-desc" style={{...styles.btnSave, background: '#e74c3c'}}>Supprimer définitivement</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RENOMMAGE DOSSIER */}
      {renameFolderModal.isOpen && (
        <div style={styles.modalOverlay} onClick={() => setRenameFolderModal({ isOpen: false, folder: null, name: '' })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Renommer le dossier</h3>
            <input 
              type="text" 
              value={renameFolderModal.name} 
              onChange={e => setRenameFolderModal({ ...renameFolderModal, name: e.target.value })}
              style={styles.modalInput}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button onClick={() => setRenameFolderModal({ isOpen: false, folder: null, name: '' })} style={styles.btnCancel}>Annuler</button>
              <button onClick={submitRenameFolder} style={styles.btnSave}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SUPPRESSION DOSSIER */}
      {deleteFolderModal.isOpen && (
        <div style={styles.modalOverlay} onClick={() => setDeleteFolderModal({ isOpen: false, folder: null })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#e74c3c' }}>Supprimer le dossier</h3>
            <p style={{ color: '#2c3e50' }}>Voulez-vous vraiment supprimer le dossier <strong>{deleteFolderModal.folder?.name}</strong> ?</p>
            <p style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '5px' }}>ATTENTION : DANGER ⚠️</p>
            <p style={{ color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '20px' }}>Cette action est irréversible. TOUTES les œuvres contenues dans ce dossier, ainsi que leurs fichiers sur le serveur, seront détruits !</p>
            <div style={styles.modalActions}>
              <button onClick={() => setDeleteFolderModal({ isOpen: false, folder: null })} style={styles.btnCancel}>Annuler</button>
              <button onClick={submitDeleteFolder} style={{...styles.btnSave, background: '#e74c3c'}}>Oui, tout détruire</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL D'IMPORTATION AVEC OPTIONS */}
      {importModal.isOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-import-title" onClick={() => setImportModal({ ...importModal, isOpen: false })}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 id="modal-import-title" style={{ marginTop: 0, color: '#2c3e50', fontSize: '1.25rem', marginBottom: '15px' }}>Importer une œuvre</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: '#7f8c8d', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold' }}>Nom de l'œuvre</label>
              <input 
                type="text" 
                value={importModal.title} 
                onChange={e => setImportModal({ ...importModal, title: e.target.value })}
                style={{ ...styles.modalInput, marginBottom: 0 }}
                placeholder="Ex: My Hero Academia - Chapitre 1"
                autoFocus
              />
            </div>

            {importModal.isPdf && (
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <span style={{ display: 'block', color: '#2d3748', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px' }}>
                  Options d'extraction PDF 📄
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#4a5568', marginBottom: '8px' }}>
                  <input 
                    type="radio" 
                    name="pdf-import-mode" 
                    checked={!importModal.isSplitRange} 
                    onChange={() => setImportModal({ ...importModal, isSplitRange: false })}
                  />
                  Tout le document
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#4a5568', marginBottom: '8px' }}>
                  <input 
                    type="radio" 
                    name="pdf-import-mode" 
                    checked={importModal.isSplitRange} 
                    onChange={() => setImportModal({ ...importModal, isSplitRange: true })}
                  />
                  Sélectionner des pages
                </label>

                {importModal.isSplitRange && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#718096', fontSize: '0.75rem', marginBottom: '3px' }}>Début</label>
                      <input 
                        type="number" 
                        min="1"
                        value={importModal.pageStart} 
                        onChange={e => setImportModal({ ...importModal, pageStart: e.target.value })}
                        style={{ ...styles.modalInput, padding: '6px 10px', marginBottom: 0 }}
                        placeholder="1"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#718096', fontSize: '0.75rem', marginBottom: '3px' }}>Fin</label>
                      <input 
                        type="number" 
                        min="1"
                        value={importModal.pageEnd} 
                        onChange={e => setImportModal({ ...importModal, pageEnd: e.target.value })}
                        style={{ ...styles.modalInput, padding: '6px 10px', marginBottom: 0 }}
                        placeholder="12"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={() => setImportModal({ ...importModal, isOpen: false })} style={styles.btnCancel}>Annuler</button>
              <button 
                onClick={submitImport} 
                disabled={importModal.title.trim() === '' || (importModal.isSplitRange && (!importModal.pageStart || !importModal.pageEnd))}
                style={{ ...styles.btnSave, opacity: (importModal.title.trim() === '' || (importModal.isSplitRange && (!importModal.pageStart || !importModal.pageEnd))) ? 0.6 : 1 }}
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#121212', fontFamily: 'sans-serif', color: 'white', display: 'flex', flexDirection: 'column' },
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', background: '#1e1e1e', height: '64px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 100 },
  logo: { fontSize: '20px', margin: 0, fontWeight: 'bold' },
  navBtn: { color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' },
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: '250px', background: '#1a1a1a', borderRight: '1px solid #333', padding: '20px', overflowY: 'auto' },
  folderList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' },
  folderItem: { padding: '10px', borderRadius: '5px', cursor: 'pointer', color: '#ecf0f1', transition: 'background 0.2s' },
  folderOptionsBtn: { background: 'transparent', border: 'none', color: '#bdc3c7', fontSize: '1.2rem', cursor: 'pointer', padding: '0 5px' },
  folderOptionsMenu: { position: 'absolute', top: '35px', right: '5px', background: '#2c3e50', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 },
  folderInput: { padding: '8px', borderRadius: '4px', border: '1px solid #333', background: '#2c2c2c', color: 'white' },
  folderAddBtn: { padding: '8px', borderRadius: '4px', border: 'none', background: '#2c3e50', color: 'white', cursor: 'pointer' },
  main: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  toolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' },
  sortControls: { display: 'flex', alignItems: 'center', gap: '10px', background: '#1e1e1e', padding: '8px 15px', borderRadius: '6px', border: '1px solid #333' },
  sortSelect: { padding: '5px', background: '#2c2c2c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' },
  sortBtn: { background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', color: '#aaaaaa' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', contentVisibility: 'auto' },
  mangaCard: { background: '#1e1e1e', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '2 / 3', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', transition: 'transform 0.1s ease-in-out', '&:hover': { transform: 'scale(1.02)' } },
  coverPlaceholder: { width: '100%', height: '100%', background: 'linear-gradient(135deg, #2c3e50, #34495e)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  coverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  coverText: { fontSize: '4rem', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' },
  mangaTitleWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', padding: '20px 8px 8px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  mangaTitle: { margin: 0, fontSize: '0.85rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '1px 1px 2px black', flex: 1 },
  optionsBtn: { background: 'transparent', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', padding: '0 5px', textShadow: '1px 1px 2px black' },
  optionsMenu: { position: 'absolute', bottom: '35px', right: '5px', background: '#2c3e50', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 },
  menuItem: { padding: '10px 15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', borderBottom: '1px solid #34495e' },
  
  // Styles de la modale
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'white', padding: '25px', borderRadius: '8px', width: '90%', maxWidth: '400px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' },
  modalInput: { width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #bdc3c7', borderRadius: '4px', marginBottom: '20px', boxSizing: 'border-box', color: '#2c3e50' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  btnCancel: { padding: '8px 15px', background: '#ecf0f1', color: '#7f8c8d', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  btnSave: { padding: '8px 15px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
