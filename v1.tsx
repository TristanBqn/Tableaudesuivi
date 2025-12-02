import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FileText, CheckCircle, AlertCircle, HelpCircle, Save, X, RefreshCw, Loader2, Settings, Link } from 'lucide-react';

// Types de données
type ProjectType = 'CIR' | 'CII' | 'Mixte' | 'Incertain';
type QualityLevel = 'Faible' | 'Moyen' | 'Excellent';

interface Project {
  id: string;
  subject: string;
  lead: string;
  type: ProjectType;
  team: string;
  quality: QualityLevel;
  notes: string;
}

// Données par défaut
const defaultData: Project[] = [];

export default function ShodoTracker() {
  const [projects, setProjects] = useState<Project[]>(defaultData);
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Configuration
  const [apiUrl, setApiUrl] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState(''); // Pour le champ de saisie
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État initial du formulaire projet
  const initialFormState: Project = {
    id: '',
    subject: '',
    lead: '',
    type: 'CIR',
    team: '',
    quality: 'Moyen',
    notes: ''
  };

  const [formData, setFormData] = useState<Project>(initialFormState);

  // --- INIT & CONFIG ---
  useEffect(() => {
    // Récupérer l'URL sauvegardée si elle existe
    const savedUrl = localStorage.getItem('shodo_api_url');
    if (savedUrl) {
      setApiUrl(savedUrl);
      setTempApiUrl(savedUrl);
    }
  }, []);

  useEffect(() => {
    // Charger les données dès qu'une URL est définie
    if (apiUrl) {
      fetchProjects();
    }
  }, [apiUrl]);

  const handleSaveConfig = () => {
    localStorage.setItem('shodo_api_url', tempApiUrl);
    setApiUrl(tempApiUrl);
    setIsConfigModalOpen(false);
  };

  // --- LOGIQUE BACKEND (Agnostique : Apps Script ou API Perso) ---

  const fetchProjects = async () => {
    if (!apiUrl) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      // Supporte le format standard {status: 'success', data: [...]}
      if (data.status === 'success' && Array.isArray(data.data)) {
        setProjects(data.data);
      } else if (Array.isArray(data)) {
        // Supporte aussi si l'API renvoie directement un tableau
        setProjects(data);
      } else {
        throw new Error("Format de données non reconnu");
      }
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les données. Vérifiez l'URL de l'API.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveToSheet = async (project: Project, action: 'create' | 'update') => {
    if (!apiUrl) return true; // Mode local réussi par défaut

    setIsLoading(true);
    try {
      // Envoi en POST. 
      // Si c'est Apps Script, il faut gérer le CORS ou utiliser 'no-cors' avec précaution,
      // mais ici on tente un fetch standard en supposant que l'API gère les headers.
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // 'text/plain' évite souvent les pre-flight OPTIONS sur Apps Script
        },
        body: JSON.stringify({ action, data: project })
      });
      
      const res = await response.json();
      return res.status === 'success';
    } catch (err) {
      console.error(err);
      setError("Erreur de sauvegarde vers le Cloud.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFromSheet = async (id: string) => {
    if (!apiUrl) return true;

    setIsLoading(true);
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', id })
      });
      return true;
    } catch (err) {
      setError("Erreur suppression Cloud.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI HELPERS ---

  const getQualityColor = (quality: QualityLevel) => {
    switch (quality) {
      case 'Excellent': return 'bg-green-100 text-green-800 border-green-200';
      case 'Moyen': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Faible': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeBadge = (type: ProjectType) => {
    switch (type) {
      case 'CIR': return 'bg-blue-100 text-blue-800';
      case 'CII': return 'bg-purple-100 text-purple-800';
      case 'Mixte': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // --- ACTIONS UTILISATEUR ---

  const handleDelete = async (id: string) => {
    if (window.confirm("Confirmer la suppression définitive ?")) {
      const oldProjects = [...projects];
      setProjects(projects.filter(p => p.id !== id));
      
      const success = await deleteFromSheet(id);
      if (!success) setProjects(oldProjects);
    }
  };

  const handleOpenProjectModal = (project?: Project) => {
    if (project) {
      setFormData(project);
      setEditingId(project.id);
    } else {
      setFormData({ ...initialFormState, id: Date.now().toString() });
      setEditingId(null);
    }
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async () => {
    if (!formData.subject) return;

    const action = editingId ? 'update' : 'create';
    const oldProjects = [...projects];
    
    // Mise à jour optimiste
    if (editingId) {
      setProjects(projects.map(p => p.id === editingId ? formData : p));
    } else {
      setProjects([...projects, { ...formData }]);
    }
    setIsProjectModalOpen(false);

    // Appel API
    const success = await saveToSheet(formData, action);
    if (!success) {
      setProjects(oldProjects);
      alert("Erreur de synchronisation. Vérifiez votre connexion.");
      setIsProjectModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            Suivi Potentiels CIR/CII - SHODO
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-slate-500">
              Récapitulatif des projets éligibles.
            </p>
            {apiUrl ? (
              <span className="cursor-help text-green-600 text-xs font-bold bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1" title={apiUrl}>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Connecté
              </span>
            ) : (
              <span className="text-orange-600 text-xs font-bold bg-orange-100 px-2 py-0.5 rounded-full">
                Mode Local (Non synchronisé)
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4 md:mt-0">
            {/* Bouton Config */}
            <button 
                onClick={() => setIsConfigModalOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                title="Configuration API / Drive"
            >
                <Settings size={18} />
                <span className="hidden md:inline">Config</span>
            </button>

            {/* Bouton Refresh */}
            {apiUrl && (
                <button 
                onClick={fetchProjects}
                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg shadow-sm transition-colors"
                title="Rafraîchir les données"
                >
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                </button>
            )}

            <button 
                onClick={() => handleOpenProjectModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
                <Plus size={18} />
                Nouveau Sujet
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium">Total Projets Identifiés</div>
          <div className="text-2xl font-bold text-slate-900">{projects.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium">Potentiel CIR</div>
          <div className="text-2xl font-bold text-blue-600">
            {projects.filter(p => p.type === 'CIR' || p.type === 'Mixte').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="text-slate-500 text-sm font-medium">Potentiel CII</div>
          <div className="text-2xl font-bold text-purple-600">
            {projects.filter(p => p.type === 'CII' || p.type === 'Mixte').length}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
           <AlertCircle size={20} />
           {error}
        </div>
      )}

      {/* Table */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[300px]">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-[1px]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <span className="text-sm text-slate-500 font-medium">Synchronisation...</span>
                </div>
            </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sujet / Titre</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Porteur</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Équipe</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qualité Docs</th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                        <FileText size={48} className="text-slate-200" />
                        <p className="italic">Aucun sujet identifié.</p>
                        {!apiUrl && (
                            <button 
                                onClick={() => setIsConfigModalOpen(true)}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                Configurer la connexion Drive
                            </button>
                        )}
                    </div>
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{project.subject}</div>
                      {project.notes && (
                        <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">{project.notes}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {project.lead}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(project.type)}`}>
                        {project.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-sm max-w-xs truncate">
                      {project.team}
                    </td>
                    <td className="p-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getQualityColor(project.quality)}`}>
                        {project.quality === 'Excellent' && <CheckCircle size={12} />}
                        {project.quality === 'Moyen' && <HelpCircle size={12} />}
                        {project.quality === 'Faible' && <AlertCircle size={12} />}
                        {project.quality}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenProjectModal(project)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(project.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFIGURATION */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Settings size={20} className="text-slate-500"/>
                        Configuration API
                    </h3>
                    <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">URL de votre Script / API</label>
                        <div className="relative">
                            <Link className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                value={tempApiUrl}
                                onChange={(e) => setTempApiUrl(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                placeholder="https://script.google.com/macros/s/..."
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Collez ici l'URL de déploiement de votre Web App Apps Script (ou de votre API Service Account). 
                            L'application utilisera cette URL pour lire et écrire les données.
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsConfigModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleSaveConfig}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                    >
                        Sauvegarder
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL PROJET (Formulaire) */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingId ? 'Modifier le sujet' : 'Ajouter un sujet'}
              </h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sujet / Titre du projet</label>
                <input 
                  type="text" 
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: Optimisation algorithmique..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Porteur (Lead)</label>
                  <input 
                    type="text" 
                    value={formData.lead}
                    onChange={(e) => setFormData({...formData, lead: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nom du Tech Lead"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as ProjectType})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="CIR">CIR (R&D)</option>
                    <option value="CII">CII (Innovation)</option>
                    <option value="Mixte">Mixte</option>
                    <option value="Incertain">A déterminer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Personnes impliquées</label>
                <input 
                  type="text" 
                  value={formData.team}
                  onChange={(e) => setFormData({...formData, team: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Noms ou équipes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qualité de la documentation</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Faible', 'Moyen', 'Excellent'] as QualityLevel[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => setFormData({...formData, quality: q})}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        formData.quality === q 
                          ? getQualityColor(q) + ' ring-2 ring-offset-1 ring-slate-300' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Commentaires</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                  placeholder="État de l'art, timesheets manquants..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsProjectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleSaveProject}
                disabled={!formData.subject}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                {isLoading ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
