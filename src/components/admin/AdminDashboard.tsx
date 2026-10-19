import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Music, 
  Building2, 
  Network, 
  TrendingUp, 
  Settings, 
  Check, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Star,
  Search,
  Download,
  Flame,
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  FileText,
  Flag,
  BarChart3,
  ListMusic,
  UserPlus,
  Activity,
  KeyRound,
  LogOut,
  ArrowLeft,
  Edit3,
  Trash2,
  HardDrive,
  Upload,
  Clock,
  Play,
  Disc3,
  Mic2,
  Globe,
  Calendar,
  Filter,
  Sparkles,
  RotateCcw,
  Ban
} from 'lucide-react';
import { 
  Track, 
  LabelArtist, 
  AdminRolePermission 
} from '../../types/music';
import { api } from '../../services/api';
import { AuthUser } from '../auth/AuthModal';

interface AdminDashboardProps {
  currentUser?: AuthUser | null;
  tracks: Track[];
  onToggleTrackFeatured: (trackId: string) => void;
  onUpdateTrackStatus: (trackId: string, status: 'active' | 'review' | 'flagged') => void;
  onDeleteTrack: (trackId: string) => void;
  permissions: AdminRolePermission[];
  onUpdatePermission: (updated: AdminRolePermission) => void;
  labelArtists: LabelArtist[];
  onTrackImported?: (track: Track) => void;
  onExitAdmin?: () => void;
  onSignOut?: () => void;
}

type AdminSection =
  | 'overview'
  | 'ytmusic_import'
  | 'catalog'
  | 'users'
  | 'artists_claims'
  | 'distributors_labels'
  | 'moderation'
  | 'analytics'
  | 'playlists_genres'
  | 'settings'
  | 'audit_logs'
  | 'security';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  tracks,
  onToggleTrackFeatured,
  onUpdateTrackStatus,
  onDeleteTrack,
  onTrackImported,
  onExitAdmin,
  onSignOut,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Real MySQL Backend State
  const [stats, setStats] = useState<any>(null);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbArtists, setDbArtists] = useState<any[]>([]);
  const [dbClaims, setDbClaims] = useState<any[]>([]);
  const [dbTracks, setDbTracks] = useState<any[]>([]);
  const [dbAlbums, setDbAlbums] = useState<any[]>([]);
  const [dbPlaylists, setDbPlaylists] = useState<any[]>([]);
  const [dbDistributors, setDbDistributors] = useState<any[]>([]);
  const [dbLabels, setDbLabels] = useState<any[]>([]);
  const [dbRolePermissions, setDbRolePermissions] = useState<any[]>([]);
  const [dbReports, setDbReports] = useState<any[]>([]);
  const [dbGenres, setDbGenres] = useState<any[]>([]);
  const [dbSettings, setDbSettings] = useState<Record<string, string>>({});
  const [dbAuditLogs, setDbAuditLogs] = useState<any[]>([]);
  const [dbSessions, setDbSessions] = useState<any[]>([]);
  const [dbSecurityEvents, setDbSecurityEvents] = useState<any[]>([]);
  const [dbAnalytics, setDbAnalytics] = useState<any>(null);

  // Filters & Form States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('listener');

  // Track editing modal state
  const [editingTrack, setEditingTrack] = useState<any | null>(null);

  // Claim review notes state
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({});

  // Moderation new report form
  const [repTargetType, setRepTargetType] = useState('track');
  const [repTargetId, setRepTargetId] = useState('');
  const [repTargetName, setRepTargetName] = useState('');
  const [repCategory, setRepCategory] = useState('copyright');
  const [repReason, setRepReason] = useState('');
  const [repNotesMap, setRepNotesMap] = useState<Record<string, string>>({});

  // Genre creation form
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreDesc, setNewGenreDesc] = useState('');
  const [newGenreOrder, setNewGenreOrder] = useState(9);

  // Distributor / Label creation form
  const [newDistName, setNewDistName] = useState('');
  const [newDistEmail, setNewDistEmail] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelEmail, setNewLabelEmail] = useState('');
  const [newLabelCountry, setNewLabelCountry] = useState('US');

  // YouTube Music Admin Discovery & Import Pipeline State
  const [ytQuery, setYtQuery] = useState('');
  const [ytFilterType, setYtFilterType] = useState<'songs' | 'albums' | 'artists' | 'playlists' | 'all'>('all');
  const [ytGenreFilter, setYtGenreFilter] = useState('All');
  const [ytCountryFilter, setYtCountryFilter] = useState('US');
  const [ytYearFilter, setYtYearFilter] = useState('All');
  const [ytLicenseDefault, setYtLicenseDefault] = useState('verified_licensed');
  const [ytAutoPublish, setYtAutoPublish] = useState(true);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytResults, setYtResults] = useState<any[]>([]);
  const [ytAlbumResults, setYtAlbumResults] = useState<any[]>([]);
  const [ytArtistResults, setYtArtistResults] = useState<any[]>([]);
  const [ytPlaylistResults, setYtPlaylistResults] = useState<any[]>([]);
  const [ytCharts, setYtCharts] = useState<any[]>([]);
  const [selectedYtMap, setSelectedYtMap] = useState<Record<string, any>>({});
  const [importingId, setImportingId] = useState<string | null>(null);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [importProgressMsg, setImportProgressMsg] = useState<string | null>(null);
  const [collectionPreview, setCollectionPreview] = useState<any | null>(null);
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);

  // Import History, Schedules, Storage & Bulk Catalog State
  const [dbImportJobs, setDbImportJobs] = useState<any[]>([]);
  const [dbImportSchedules, setDbImportSchedules] = useState<any[]>([]);
  const [dbStorage, setDbStorage] = useState<any>(null);
  const [selectedCatalogTrackIds, setSelectedCatalogTrackIds] = useState<string[]>([]);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);

  // Automated Import Schedule Form State
  const [schName, setSchName] = useState('');
  const [schQuery, setSchQuery] = useState('');
  const [schGenre, setSchGenre] = useState('Afrobeats');
  const [schCountry, setSchCountry] = useState('NG');
  const [schYear, setSchYear] = useState('2025');
  const [schMaxItems, setSchMaxItems] = useState(8);
  const [schFrequency, setSchFrequency] = useState('daily');
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // Authorized Audio / Artwork Upload State
  const [uploadTargetTrackId, setUploadTargetTrackId] = useState('');
  const [uploadMediaType, setUploadMediaType] = useState<'audio' | 'artwork'>('audio');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminDashboard();
      if (data && data.status === 'success') {
        setStats(data.stats || {});
        setDbUsers(data.users || []);
        setDbArtists(data.artists || []);
        setDbClaims(data.claims || []);
        setDbTracks(data.tracks || []);
        setDbAlbums(data.albums || []);
        setDbPlaylists(data.playlists || []);
        setDbDistributors(data.distributors || []);
        setDbLabels(data.labels || []);
        setDbRolePermissions(data.role_permissions || []);
        setDbReports(data.reports || []);
        setDbGenres(data.genres || []);
        setDbImportJobs(data.import_jobs || []);
        setDbImportSchedules(data.import_schedules || []);
        setDbStorage(data.storage || null);
        setDbAuditLogs(data.audit_logs || []);
        setDbSessions(data.sessions || []);
        setDbSecurityEvents(data.security_events || []);
        setDbAnalytics(data.analytics || {});

        const settingsMap: Record<string, string> = {};
        if (Array.isArray(data.settings)) {
          data.settings.forEach((s: any) => {
            settingsMap[s.setting_key] = s.setting_value;
          });
        }
        setDbSettings(settingsMap);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load administrator data from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // --- Handlers ---
  const handleUpdateUser = async (userId: string, updates: { role?: string; status?: 'active' | 'suspended' | 'banned'; email_verified?: boolean }) => {
    try {
      const res = await api.updateAdminUser({ user_id: userId, ...updates });
      showNotice(res.message || 'User updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword) return;
    try {
      const res = await api.createAdminUser({
        email: newUserEmail.trim(),
        display_name: newUserName.trim() || newUserEmail.split('@')[0],
        password: newUserPassword,
        role: newUserRole,
        must_change_password: false
      });
      showNotice(res.message || 'User account created.');
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Could not create user.');
    }
  };

  const handleReviewClaim = async (claimId: string, decision: 'approved' | 'rejected' | 'escalated' | 'disputed') => {
    try {
      const res = await api.reviewAdminClaim({
        claim_id: claimId,
        decision,
        notes: claimNotes[claimId] || `Reviewed by administrator (${decision})`
      });
      showNotice(res.message || 'Claim updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Claim review failed.');
    }
  };

  const handleUpdateArtist = async (artistId: string, updates: { verified?: boolean; claimed_status?: string }) => {
    try {
      const res = await api.updateAdminArtist({ artist_id: artistId, ...updates });
      showNotice(res.message || 'Artist updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Artist update failed.');
    }
  };

  const handleUpdateTrack = async (trackId: string, updates: any) => {
    try {
      const res = await api.updateAdminTrack({ track_id: trackId, ...updates });
      showNotice(res.message || 'Track updated.');
      if (updates.featured_on_home !== undefined) {
        onToggleTrackFeatured(trackId);
      }
      if (updates.status) {
        onUpdateTrackStatus(trackId, updates.status);
      }
      if (updates.delete_permanently) {
        onDeleteTrack(trackId);
      }
      setEditingTrack(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update track.');
    }
  };

  const handleUpdateAlbum = async (albumId: string, status: string, del?: boolean) => {
    try {
      const res = await api.updateAdminAlbum({ album_id: albumId, status, delete: del });
      showNotice(res.message || 'Album updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update album.');
    }
  };

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDistName.trim()) return;
    try {
      const res = await api.updateAdminDistributor({
        name: newDistName.trim(),
        contact_email: newDistEmail.trim(),
        status: 'active',
        can_direct_upload: true,
        can_edit_metadata: true
      });
      showNotice(res.message || 'Distributor added.');
      setNewDistName('');
      setNewDistEmail('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to add distributor.');
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      const res = await api.updateAdminLabel({
        name: newLabelName.trim(),
        contact_email: newLabelEmail.trim(),
        country: newLabelCountry,
        status: 'active',
        can_manage_roster: true
      });
      showNotice(res.message || 'Label added.');
      setNewLabelName('');
      setNewLabelEmail('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to add label.');
    }
  };

  const handleResolveReport = async (reportId: string, status: string, enforceAction?: string) => {
    try {
      const res = await api.resolveAdminReport({
        report_id: reportId,
        status,
        resolution_notes: repNotesMap[reportId] || `Handled by admin (${status})`,
        enforce_action: enforceAction
      });
      showNotice(res.message || 'Moderation report updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update report.');
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repReason.trim() || !repTargetName.trim()) return;
    try {
      const res = await api.createAdminReport({
        target_type: repTargetType,
        target_id: repTargetId.trim() || 'trk_yt_c2gK9tq57iQ',
        target_name: repTargetName.trim(),
        category: repCategory,
        reason: repReason.trim()
      });
      showNotice(res.message || 'Moderation case logged.');
      setRepTargetId('');
      setRepTargetName('');
      setRepReason('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Could not log moderation report.');
    }
  };

  const handleUpdatePlaylist = async (playlistId: string, updates: any) => {
    try {
      const res = await api.updateAdminPlaylist({ playlist_id: playlistId, ...updates });
      showNotice(res.message || 'Playlist updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Playlist update failed.');
    }
  };

  const handleSaveGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) return;
    try {
      const res = await api.saveAdminGenre({
        name: newGenreName.trim(),
        description: newGenreDesc.trim(),
        is_featured: true,
        display_order: Number(newGenreOrder) || 9
      });
      showNotice(res.message || 'Genre saved.');
      setNewGenreName('');
      setNewGenreDesc('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save genre.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateAdminSettings(dbSettings);
      showNotice(res.message || 'System settings saved.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save system settings.');
    }
  };

  const handleSearchYouTube = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? ytQuery).trim();
    if (!q) return;
    setIsSearchingYt(true);
    setError(null);
    try {
      const res = await api.searchYouTubeMusic(q, ytFilterType, {
        country: ytCountryFilter,
        year: ytYearFilter,
        genre: ytGenreFilter,
      });
      setYtResults(res?.results?.songs || []);
      setYtAlbumResults(res?.results?.albums || []);
      setYtArtistResults(res?.results?.artists || []);
      setYtPlaylistResults(res?.results?.playlists || []);
    } catch (err: any) {
      setError(err?.message || 'YouTube Music search failed.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleLoadYtCharts = async () => {
    setIsSearchingYt(true);
    try {
      const res = await api.getYouTubeMusicCharts();
      const chartList = res?.charts || [];
      setYtCharts(chartList);
      if (ytResults.length === 0) {
        setYtResults(chartList);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load YT Music charts.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleImportYouTubeSong = async (song: any, forceResync: boolean = false) => {
    const vid = song.videoId || String(song.id || '').replace(/^(trk_)?yt_/, '');
    setImportingId(vid || song.title);
    setImportProgressMsg(`Acquiring audio & artwork for "${song.title}" (${song.artist})...`);
    try {
      const res = await api.importYouTubeMusicTrack({
        title: song.title,
        artist: song.artist,
        album: song.album || 'Single',
        genre: ytGenreFilter !== 'All' ? ytGenreFilter : (song.genre || 'Pop'),
        country: ytCountryFilter || 'US',
        release_year: ytYearFilter !== 'All' && /^\d{4}$/.test(ytYearFilter) ? Number(ytYearFilter) : Number(song.year || new Date().getFullYear()),
        duration: song.duration || 185,
        cover_url: song.cover_url,
        videoId: vid,
        license_status: ytLicenseDefault,
        auto_publish: ytAutoPublish,
        force_resync: forceResync,
      });
      if (res && res.track && onTrackImported) {
        onTrackImported(res.track);
      }
      showNotice(res.message || `Imported "${song.title}" to server storage.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setImportingId(null);
      setImportProgressMsg(null);
    }
  };

  const handleToggleSelectYtSong = (song: any) => {
    const key = song.videoId || song.id || `${song.title}-${song.artist}`;
    setSelectedYtMap((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = song;
      }
      return next;
    });
  };

  const handleBulkImportSelectedYt = async () => {
    const items = Object.values(selectedYtMap);
    if (items.length === 0) return;
    setIsBulkImporting(true);
    setImportProgressMsg(`Running bulk import pipeline for ${items.length} selected songs (acquiring audio & artwork)...`);
    try {
      const res = await api.bulkImportYouTubeMusicTracks({
        items,
        genre: ytGenreFilter !== 'All' ? ytGenreFilter : 'Pop',
        country: ytCountryFilter || 'US',
        license_status: ytLicenseDefault,
        auto_publish: ytAutoPublish,
      });
      showNotice(res.message || `Bulk import finished (${res.imported_count} imported).`);
      setSelectedYtMap({});
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Bulk import failed.');
    } finally {
      setIsBulkImporting(false);
      setImportProgressMsg(null);
    }
  };

  const handleInspectYtCollection = async (type: 'album' | 'artist' | 'playlist', item: any) => {
    setIsLoadingCollection(true);
    setCollectionPreview({
      type,
      title: item.title || item.name,
      artist: item.artist || item.curator || item.name || 'Artist',
      cover_url: item.cover_url || item.avatar_url,
      tracks: [],
    });
    try {
      const browseId = item.browseId || item.id;
      if (type === 'album') {
        const res = await api.getYouTubeMusicAlbum(browseId);
        if (res?.album) {
          setCollectionPreview({
            type: 'album',
            title: res.album.title || item.title,
            artist: res.album.artist || item.artist,
            cover_url: res.album.cover_url || item.cover_url,
            year: res.album.year,
            tracks: res.album.tracks || [],
          });
        }
      } else if (type === 'artist') {
        const res = await api.getYouTubeMusicArtist(browseId, item.name);
        if (res) {
          setCollectionPreview({
            type: 'artist',
            title: res.artist?.name || item.name,
            artist: res.artist?.name || item.name,
            cover_url: res.artist?.avatar_url || item.avatar_url,
            description: res.artist?.description,
            tracks: res.top_songs || [],
          });
        }
      } else if (type === 'playlist') {
        const res = await api.getYouTubeMusicPlaylist(browseId);
        if (res?.playlist) {
          setCollectionPreview({
            type: 'playlist',
            title: res.playlist.title || item.title,
            artist: res.playlist.curator || 'Flontmie Editorial',
            cover_url: res.playlist.cover_url || item.cover_url,
            description: res.playlist.description,
            tracks: res.playlist.tracks || [],
          });
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to inspect collection.');
    } finally {
      setIsLoadingCollection(false);
    }
  };

  const handleImportEntireCollection = async () => {
    if (!collectionPreview || !Array.isArray(collectionPreview.tracks) || collectionPreview.tracks.length === 0) return;
    setIsBulkImporting(true);
    setImportProgressMsg(`Importing ${collectionPreview.type} "${collectionPreview.title}" (${collectionPreview.tracks.length} tracks)...`);
    try {
      const res = await api.importYouTubeMusicCollection({
        collection_type: collectionPreview.type,
        title: collectionPreview.title,
        artist: collectionPreview.artist,
        cover_url: collectionPreview.cover_url,
        description: collectionPreview.description,
        genre: ytGenreFilter !== 'All' ? ytGenreFilter : 'Pop',
        country: ytCountryFilter || 'US',
        license_status: ytLicenseDefault,
        tracks: collectionPreview.tracks,
      });
      showNotice(res.message || 'Collection imported to local storage.');
      setCollectionPreview(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Collection import failed.');
    } finally {
      setIsBulkImporting(false);
      setImportProgressMsg(null);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schName.trim() || !schQuery.trim()) return;
    try {
      const res = await api.createImportSchedule({
        name: schName.trim(),
        search_query: schQuery.trim(),
        filter_type: 'songs',
        genre: schGenre,
        country: schCountry,
        release_year: schYear,
        max_items: schMaxItems,
        auto_publish: ytAutoPublish,
        license_status: ytLicenseDefault,
        frequency: schFrequency,
      });
      showNotice(res.message || 'Automated import schedule created.');
      setSchName('');
      setSchQuery('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create schedule.');
    }
  };

  const handleRunScheduleNow = async (scheduleId: string) => {
    setRunningScheduleId(scheduleId);
    setImportProgressMsg('Executing automated search & synchronization rule...');
    try {
      const res = await api.runImportSchedule(scheduleId);
      showNotice(res.message || 'Schedule executed.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to execute schedule.');
    } finally {
      setRunningScheduleId(null);
      setImportProgressMsg(null);
    }
  };

  const handleSyncAllServerStorage = async () => {
    setIsSyncingStorage(true);
    setImportProgressMsg('Verifying and synchronizing local server audio & artwork files...');
    try {
      const res = await api.syncAllStorage();
      showNotice(res.message || 'All media files synchronized.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Storage sync failed.');
    } finally {
      setIsSyncingStorage(false);
      setImportProgressMsg(null);
    }
  };

  const handleAuthorizedMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    try {
      const res = await api.uploadMediaFile(file, uploadMediaType, uploadTargetTrackId || undefined);
      showNotice(res.message || `Uploaded ${uploadMediaType} file (${Math.round((res.size || 0) / 1024)} KB) and synced.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Media upload failed.');
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleBulkCatalogAction = async (action: 'publish' | 'unpublish' | 'verify_license' | 'resync_audio' | 'delete') => {
    if (selectedCatalogTrackIds.length === 0) return;
    try {
      const res = await api.bulkUpdateAdminTracks(selectedCatalogTrackIds, action);
      showNotice(res.message || 'Bulk catalog update applied.');
      setSelectedCatalogTrackIds([]);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Bulk catalog operation failed.');
    }
  };

  const filteredUsers = dbUsers.filter((u) => {
    const matchesQ =
      !userSearch.trim() ||
      String(u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      String(u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      String(u.display_name || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const matchesStatus = !userStatusFilter || (u.status || 'active') === userStatusFilter;
    return matchesQ && matchesRole && matchesStatus;
  });

  const navItems: { id: AdminSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'ytmusic_import', label: 'Ingestion & Discovery', icon: <Download className="w-4 h-4" />, badge: dbImportJobs.length },
    { id: 'catalog', label: 'Music Releases', icon: <Music className="w-4 h-4" />, badge: stats?.total_tracks ?? dbTracks.length },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, badge: stats?.total_users },
    { id: 'artists_claims', label: 'Artists & Claims', icon: <CheckCircle2 className="w-4 h-4" />, badge: stats?.pending_claims },
    { id: 'distributors_labels', label: 'Distributors & Labels', icon: <Network className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation', icon: <Flag className="w-4 h-4" />, badge: stats?.open_reports },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'playlists_genres', label: 'Playlists & Genres', icon: <ListMusic className="w-4 h-4" /> },
    { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit_logs', label: 'Audit Logs', icon: <FileText className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" />, badge: stats?.active_sessions },
  ];

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-200">
      {/* Top Protected Admin Banner */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-amber-500/25 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Protected Route · /admin
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-xs text-neutral-300 font-mono">
                {currentUser?.email || 'earr.music@gmail.com'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight mt-0.5">
              Master Administrator Dashboard
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Role-based governance connected to live backend APIs and secure database
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchAdminData}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sync Data</span>
          </button>

          {onExitAdmin && (
            <button
              onClick={onExitAdmin}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Streaming App</span>
            </button>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-xs font-semibold text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs across all 11 required Admin Sections */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/[0.08]">
        {navItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? 'bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/20'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {typeof item.badge === 'number' && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    active ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { label: 'Total Users', val: stats?.total_users ?? dbUsers.length, sub: `${stats?.active_users ?? dbUsers.length} active` },
              { label: 'Verified Artists', val: stats?.total_artists ?? dbArtists.length, sub: `${stats?.pending_claims ?? 0} pending claims` },
              { label: 'Distributors & Labels', val: (stats?.total_distributors ?? dbDistributors.length) + (stats?.total_labels ?? dbLabels.length), sub: `${stats?.total_distributors ?? 4} distributors` },
              { label: 'Songs & Albums', val: `${stats?.total_tracks ?? dbTracks.length} / ${stats?.total_albums ?? dbAlbums.length}`, sub: `${stats?.total_playlists ?? dbPlaylists.length} playlists` },
              { label: 'Total Streams', val: ((Number(stats?.total_streams) || 0) / 1000000).toFixed(1) + 'M', sub: 'Verified stream count' },
            ].map((card, i) => (
              <div key={i} className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.07] space-y-1">
                <p className="text-[11px] font-medium text-neutral-400">{card.label}</p>
                <p className="text-2xl font-extrabold font-mono text-white">{card.val}</p>
                <p className="text-[11px] text-amber-400/90 font-mono">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Platform Activity */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Recent Platform & Admin Activity</span>
                </h3>
                <button onClick={() => setActiveSection('audit_logs')} className="text-xs text-amber-400 hover:underline">
                  View All Logs
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(stats?.recent_activity || dbAuditLogs.slice(0, 10)).map((act: any) => (
                  <div key={act.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-amber-300">{act.action}</span>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {act.user_email || act.user_id || 'System'} · {act.entity_type} {act.entity_id ? `(${act.entity_id})` : ''}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0">{act.created_at}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Action Queue */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3">
                Governance Priorities & Pending Reviews
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">Pending Artist Profile Claims</p>
                    <p className="text-[11px] text-neutral-400">{stats?.pending_claims ?? 0} claims awaiting identity verification</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('artists_claims')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold"
                  >
                    Review Claims
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">Open Moderation & Copyright Reports</p>
                    <p className="text-[11px] text-neutral-400">{stats?.open_reports ?? 0} open reports or appeals</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('moderation')}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-semibold"
                  >
                    Open Moderation
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">Active Authenticated Sessions</p>
                    <p className="text-[11px] text-neutral-400">{stats?.active_sessions ?? dbSessions.length} active sessions tracked in database</p>
                  </div>
                  <button
                    onClick={() => setActiveSection('security')}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white font-semibold"
                  >
                    Security Console
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: USERS */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.08] flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email, username, or display name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
            >
              <option value="">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="distributor">Distributors</option>
              <option value="label">Record Labels</option>
              <option value="artist">Artists</option>
              <option value="listener">Listeners</option>
            </select>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.03] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">User / Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Verified</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{u.display_name}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">
                          {u.email} · @{u.username}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white font-semibold"
                        >
                          <option value="listener">Listener</option>
                          <option value="artist">Artist</option>
                          <option value="label">Label</option>
                          <option value="distributor">Distributor</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            (u.status || 'active') === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleUpdateUser(u.id, { email_verified: !Number(u.email_verified) })}
                          className={`text-[11px] font-mono ${
                            Number(u.email_verified) ? 'text-emerald-400' : 'text-amber-400 underline'
                          }`}
                        >
                          {Number(u.email_verified) ? '✓ Verified' : 'Verify Now'}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-400">
                        {u.last_login_at || u.created_at}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {(u.status || 'active') === 'active' ? (
                          <button
                            onClick={() => handleUpdateUser(u.id, { status: 'suspended' })}
                            className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[11px] font-semibold"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateUser(u.id, { status: 'active' })}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-semibold"
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provision New Account Form */}
          <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Provision New Account</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email address"
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
              />
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Display Name"
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
              />
              <input
                type="password"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Initial Password"
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
              />
              <div className="flex gap-2">
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-xs text-white"
                >
                  <option value="listener">Listener</option>
                  <option value="artist">Artist</option>
                  <option value="label">Label</option>
                  <option value="distributor">Distributor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  Create
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 3: ARTISTS & CLAIMS */}
      {activeSection === 'artists_claims' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Artist Profile Claims & Dispute Resolution ({dbClaims.length})</h3>
            <div className="space-y-3">
              {dbClaims.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{c.artist_name || c.artist_id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : c.status === 'rejected'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-neutral-300">
                      Claimant: <strong>{c.claimant_name}</strong> ({c.claimant_email}) · Evidence: {c.evidence_type}
                    </p>
                    <p className="text-neutral-400">{c.evidence_details}</p>
                    <input
                      type="text"
                      value={claimNotes[c.id] ?? c.review_notes ?? ''}
                      onChange={(e) => setClaimNotes({ ...claimNotes, [c.id]: e.target.value })}
                      placeholder="Add verification or dispute resolution notes..."
                      className="mt-1 w-full max-w-md px-2.5 py-1 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleReviewClaim(c.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      Approve & Verify
                    </button>
                    <button
                      onClick={() => handleReviewClaim(c.id, 'disputed')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold"
                    >
                      Mark Disputed
                    </button>
                    <button
                      onClick={() => handleReviewClaim(c.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Verified Artist Profiles ({dbArtists.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Artist</th>
                    <th className="py-3 px-4">Label & Distributor</th>
                    <th className="py-3 px-4">Claim Status</th>
                    <th className="py-3 px-4 text-center">Identity Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbArtists.map((a) => (
                    <tr key={a.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 flex items-center gap-2.5">
                        <img src={a.avatar_url} alt={a.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                        <span className="font-semibold text-white">{a.name}</span>
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {a.label_name || 'Independent'} · {a.distributor_name || 'Direct'}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={a.claimed_status || 'claimed'}
                          onChange={(e) => handleUpdateArtist(a.id, { claimed_status: e.target.value })}
                          className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs text-white"
                        >
                          <option value="unclaimed">Unclaimed</option>
                          <option value="pending">Pending</option>
                          <option value="claimed">Claimed</option>
                          <option value="disputed">Disputed</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleUpdateArtist(a.id, { verified: !Number(a.verified) })}
                          className={`px-2.5 py-1 rounded-lg font-semibold ${
                            Number(a.verified) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-neutral-400'
                          }`}
                        >
                          {Number(a.verified) ? '✓ Verified' : 'Unverified'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: MUSIC CATALOG */}
      {activeSection === 'catalog' && (
        <div className="space-y-6">
          {/* Edit Track Modal if Open */}
          {editingTrack && (
            <div className="p-5 rounded-2xl bg-neutral-900 border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">Edit Song: {editingTrack.title}</h4>
                <button onClick={() => setEditingTrack(null)} className="text-neutral-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input
                  type="text"
                  value={editingTrack.title}
                  onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                  placeholder="Title"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
                <input
                  type="text"
                  value={editingTrack.artist_name}
                  onChange={(e) => setEditingTrack({ ...editingTrack, artist_name: e.target.value })}
                  placeholder="Artist"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
                <input
                  type="text"
                  value={editingTrack.genre}
                  onChange={(e) => setEditingTrack({ ...editingTrack, genre: e.target.value })}
                  placeholder="Genre"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
                <input
                  type="text"
                  value={editingTrack.cover_art_url}
                  onChange={(e) => setEditingTrack({ ...editingTrack, cover_art_url: e.target.value })}
                  placeholder="Artwork URL"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() =>
                    handleUpdateTrack(editingTrack.id, {
                      title: editingTrack.title,
                      artist_name: editingTrack.artist_name,
                      genre: editingTrack.genre,
                      cover_art_url: editingTrack.cover_art_url
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs"
                >
                  Save Metadata & Artwork
                </button>
              </div>
            </div>
          )}

          {/* Songs Table with Bulk Selection, Licensing Verification & Audio Sync Controls */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-white">Songs Library ({dbTracks.length || tracks.length})</h3>
                <button
                  onClick={() => setActiveSection('ytmusic_import')}
                  className="px-3 py-1 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open Ingestion & Sync Hub</span>
                </button>
              </div>

              {selectedCatalogTrackIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-amber-400 font-mono font-bold mr-1">
                    {selectedCatalogTrackIds.length} selected:
                  </span>
                  <button
                    onClick={() => handleBulkCatalogAction('publish')}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => handleBulkCatalogAction('unpublish')}
                    className="px-2.5 py-1 rounded bg-neutral-700 text-white font-semibold cursor-pointer"
                  >
                    Unpublish
                  </button>
                  <button
                    onClick={() => handleBulkCatalogAction('verify_license')}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Verify License
                  </button>
                  <button
                    onClick={() => handleBulkCatalogAction('resync_audio')}
                    className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold cursor-pointer"
                  >
                    Re-Sync Audio
                  </button>
                  <button
                    onClick={() => handleBulkCatalogAction('delete')}
                    className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={dbTracks.length > 0 && selectedCatalogTrackIds.length === dbTracks.length}
                        onChange={(e) =>
                          setSelectedCatalogTrackIds(e.target.checked ? dbTracks.map((t) => t.id) : [])
                        }
                        className="accent-amber-500"
                      />
                    </th>
                    <th className="py-3 px-4">Song & Artwork</th>
                    <th className="py-3 px-4">Genre & Year</th>
                    <th className="py-3 px-4">Local Audio & License</th>
                    <th className="py-3 px-4 text-right">Streams</th>
                    <th className="py-3 px-4 text-center">Featured</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbTracks.map((t) => {
                    const isChecked = selectedCatalogTrackIds.includes(t.id);
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedCatalogTrackIds((prev) =>
                                e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                              );
                            }}
                            className="accent-amber-500"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img src={t.cover_art_url} alt={t.title} referrerPolicy="no-referrer" className="w-9 h-9 rounded-lg object-cover bg-neutral-800" />
                            <div>
                              <p className="font-semibold text-white">{t.title}</p>
                              <p className="text-[11px] text-neutral-400">{t.artist_name} · {t.album_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-neutral-300">
                          <span>{t.genre}</span>
                          {t.release_year && <span className="text-[10px] font-mono text-neutral-500 block">{t.release_year} · {t.country || 'US'}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono w-fit ${
                              t.local_audio_path ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                            }`}>
                              {t.local_audio_path ? `Hosted (${(t.audio_format || 'm4a').toUpperCase()})` : 'Pending Sync'}
                            </span>
                            <select
                              value={t.license_status || 'verified_licensed'}
                              onChange={(e) => handleUpdateTrack(t.id, { license_status: e.target.value })}
                              className="px-1.5 py-0.5 rounded bg-neutral-900 border border-white/10 text-[10px] text-neutral-300 w-fit"
                            >
                              <option value="verified_licensed">Verified Licensed</option>
                              <option value="direct_partner">Direct Partner</option>
                              <option value="royalty_free">Royalty Free</option>
                              <option value="pending_verification">Pending Verification</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white">
                          {(Number(t.stream_count) || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleUpdateTrack(t.id, { featured_on_home: !Number(t.featured_on_home ?? 1) })}
                            className={`p-1.5 rounded-lg ${Number(t.featured_on_home ?? 1) ? 'text-amber-400 bg-amber-500/10' : 'text-neutral-500'}`}
                          >
                            <Star className={`w-4 h-4 ${Number(t.featured_on_home ?? 1) ? 'fill-amber-400' : ''}`} />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={t.status || 'active'}
                            onChange={(e) => handleUpdateTrack(t.id, { status: e.target.value })}
                            className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs text-white"
                          >
                            <option value="active">Published / Active</option>
                            <option value="review">In Review</option>
                            <option value="flagged">Flagged</option>
                            <option value="unpublished">Unpublished</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setEditingTrack(t)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-neutral-200 inline-flex items-center"
                            title="Edit Metadata & Artwork"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleUpdateTrack(t.id, { delete_permanently: true })}
                            className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 inline-flex items-center"
                            title="Remove Track & Local Files"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Albums Governance */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Albums & Releases ({dbAlbums.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Album</th>
                    <th className="py-3 px-4">Artist</th>
                    <th className="py-3 px-4">Genre</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbAlbums.map((alb) => (
                    <tr key={alb.id}>
                      <td className="py-3 px-4 font-semibold text-white">{alb.title}</td>
                      <td className="py-3 px-4 text-neutral-300">{alb.artist_name}</td>
                      <td className="py-3 px-4 text-neutral-400">{alb.genre}</td>
                      <td className="py-3 px-4">
                        <select
                          value={alb.status || 'published'}
                          onChange={(e) => handleUpdateAlbum(alb.id, e.target.value)}
                          className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs text-white"
                        >
                          <option value="published">Published</option>
                          <option value="review">In Review</option>
                          <option value="unpublished">Unpublished</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleUpdateAlbum(alb.id, 'unpublished', true)}
                          className="text-red-400 hover:underline text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED ADMIN-ONLY YT MUSIC DISCOVERY, IMPORT PIPELINE & STORAGE HUB */}
      {activeSection === 'ytmusic_import' && (
        <div className="space-y-6">
          {/* Import Pipeline Progress Banner */}
          {importProgressMsg && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span className="font-semibold">{importProgressMsg}</span>
            </div>
          )}

          {/* Server File Manager Storage & Audio Sync Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.08] space-y-1">
              <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                <span>Server Audio Storage</span>
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-extrabold font-mono text-white">
                {dbStorage?.audio_files_count ?? dbTracks.length} Audio Files
              </p>
              <p className="text-[11px] font-mono text-emerald-400">
                {dbStorage?.audio_size_mb ?? '12.4'} MB hosted in /storage/audio
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.08] space-y-1">
              <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                <span>Local Artwork Cache</span>
                <Disc3 className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-extrabold font-mono text-white">
                {dbStorage?.artwork_files_count ?? dbTracks.length} Artworks
              </p>
              <p className="text-[11px] font-mono text-blue-400">
                {dbStorage?.artwork_size_mb ?? '3.8'} MB hosted in /storage/artwork
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.08] space-y-1">
              <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                <span>Import Pipeline History</span>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-extrabold font-mono text-white">
                {dbImportJobs.length} Import Jobs
              </p>
              <p className="text-[11px] font-mono text-amber-400">
                {dbImportSchedules.length} Automated Sync Rules
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-900/50 border border-white/[0.08] flex flex-col justify-between gap-2">
              <div className="text-[11px] text-neutral-300 font-semibold">
                Server Storage Integrity & Sync
              </div>
              <button
                onClick={handleSyncAllServerStorage}
                disabled={isSyncingStorage}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSyncingStorage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Verify & Sync All Local Audio</span>
              </button>
            </div>
          </div>

          {/* 1. Admin-Only Search, Metadata Filters & Bulk Import Controls */}
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500" />
                  <h3 className="text-base font-extrabold text-white">
                    Music Discovery & Media Ingestion Engine
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Admin Protected
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Search songs, albums, artists, and playlists with metadata filters. Audio streams & artwork are ingested into server storage and linked in the system.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleLoadYtCharts}
                  disabled={isSearchingYt}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                  <span>Load Global Charts</span>
                </button>

                {Object.keys(selectedYtMap).length > 0 && (
                  <button
                    onClick={handleBulkImportSelectedYt}
                    disabled={isBulkImporting}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    {isBulkImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Bulk Import Selected ({Object.keys(selectedYtMap).length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Input & Metadata Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 text-xs">
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchYouTube()}
                  placeholder="Search songs, albums, artists, playlists, ISRC..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
              </div>

              <select
                value={ytFilterType}
                onChange={(e) => setYtFilterType(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              >
                <option value="all">All Types (Songs, Albums, Artists, Playlists)</option>
                <option value="songs">Songs Only</option>
                <option value="albums">Albums Only</option>
                <option value="artists">Artists Only</option>
                <option value="playlists">Playlists Only</option>
              </select>

              <select
                value={ytGenreFilter}
                onChange={(e) => setYtGenreFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              >
                {['All', 'Afrobeats', 'Pop', 'Hip-Hop', 'R&B', 'Amapiano', 'Electronic', 'Lo-Fi', 'Gospel', 'Reggae', 'Latin'].map((g) => (
                  <option key={g} value={g}>
                    Genre: {g}
                  </option>
                ))}
              </select>

              <select
                value={ytCountryFilter}
                onChange={(e) => setYtCountryFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
              >
                {[
                  { code: 'US', name: 'United States (US)' },
                  { code: 'NG', name: 'Nigeria (NG)' },
                  { code: 'GB', name: 'United Kingdom (GB)' },
                  { code: 'ZA', name: 'South Africa (ZA)' },
                  { code: 'GH', name: 'Ghana (GH)' },
                  { code: 'KE', name: 'Kenya (KE)' },
                  { code: 'CA', name: 'Canada (CA)' },
                  { code: 'FR', name: 'France (FR)' },
                  { code: 'BR', name: 'Brazil (BR)' },
                ].map((c) => (
                  <option key={c.code} value={c.code}>
                    Market: {c.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <select
                  value={ytYearFilter}
                  onChange={(e) => setYtYearFilter(e.target.value)}
                  className="flex-1 px-2.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  {['All', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019'].map((yr) => (
                    <option key={yr} value={yr}>
                      Year: {yr}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleSearchYouTube()}
                  disabled={isSearchingYt}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {isSearchingYt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Import Licensing & Publishing Defaults Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06] text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400">Default License Status:</span>
                  <select
                    value={ytLicenseDefault}
                    onChange={(e) => setYtLicenseDefault(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-white/10 text-white"
                  >
                    <option value="verified_licensed">Verified Licensed</option>
                    <option value="direct_partner">Direct Partner License</option>
                    <option value="royalty_free">Royalty Free / Authorized</option>
                    <option value="pending_verification">Pending Verification</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                  <input
                    type="checkbox"
                    checked={ytAutoPublish}
                    onChange={(e) => setYtAutoPublish(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span>Auto-Publish to Listener Frontend upon Sync</span>
                </label>
              </div>

              {ytResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const next: Record<string, any> = {};
                      ytResults.forEach((s) => {
                        const k = s.videoId || s.id || `${s.title}-${s.artist}`;
                        next[k] = s;
                      });
                      setSelectedYtMap(next);
                    }}
                    className="text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    Select All Songs ({ytResults.length})
                  </button>
                  {Object.keys(selectedYtMap).length > 0 && (
                    <button
                      onClick={() => setSelectedYtMap({})}
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Search Results: Songs */}
            {ytResults.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Discovered Songs ({ytResults.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {ytResults.map((item) => {
                    const vid = item.videoId || item.id;
                    const key = vid || `${item.title}-${item.artist}`;
                    const isSelected = Boolean(selectedYtMap[key]);
                    const alreadyInCatalog = dbTracks.some(
                      (t) =>
                        (vid && t.video_id === vid) ||
                        (t.title?.toLowerCase() === item.title?.toLowerCase() &&
                          t.artist_name?.toLowerCase() === item.artist?.toLowerCase())
                    );

                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/40'
                            : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectYtSong(item)}
                            className="accent-amber-500 shrink-0"
                          />
                          <img
                            src={item.cover_url}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-lg object-cover shrink-0 bg-neutral-800"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{item.title}</p>
                            <p className="text-neutral-400 truncate text-[11px]">{item.artist}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {alreadyInCatalog ? (
                                <span className="text-[10px] font-mono text-emerald-400">✓ In System</span>
                              ) : (
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {item.album || 'Single'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleImportYouTubeSong(item, alreadyInCatalog)}
                            disabled={importingId === vid}
                            className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer ${
                              alreadyInCatalog
                                ? 'bg-white/10 hover:bg-white/20 text-neutral-200'
                                : 'bg-white hover:bg-neutral-200 text-black'
                            }`}
                            title={alreadyInCatalog ? 'Force Re-Sync Audio & Metadata' : 'Download Audio & Ingest'}
                          >
                            {importingId === vid ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>{alreadyInCatalog ? 'Re-Sync' : 'Import'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results: Albums, Artists & Playlists */}
            {(ytAlbumResults.length > 0 || ytArtistResults.length > 0 || ytPlaylistResults.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-white/[0.06]">
                {/* Albums */}
                {ytAlbumResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Albums ({ytAlbumResults.length})
                    </h4>
                    <div className="space-y-2">
                      {ytAlbumResults.slice(0, 6).map((alb) => (
                        <div key={alb.id || alb.browseId} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={alb.cover_url} alt={alb.title} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{alb.title}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{alb.artist} · {alb.year}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInspectYtCollection('album', alb)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold shrink-0 cursor-pointer"
                          >
                            Inspect & Import
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artists */}
                {ytArtistResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Artists ({ytArtistResults.length})
                    </h4>
                    <div className="space-y-2">
                      {ytArtistResults.slice(0, 6).map((art) => (
                        <div key={art.id || art.name} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={art.avatar_url} alt={art.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{art.name}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{art.subscribers}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInspectYtCollection('artist', art)}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold shrink-0 cursor-pointer"
                          >
                            Discography
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playlists */}
                {ytPlaylistResults.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Playlists ({ytPlaylistResults.length})
                    </h4>
                    <div className="space-y-2">
                      {ytPlaylistResults.slice(0, 6).map((pl) => (
                        <div key={pl.id || pl.browseId} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={pl.cover_url} alt={pl.title} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{pl.title}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{pl.curator}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInspectYtCollection('playlist', pl)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0 cursor-pointer"
                          >
                            Inspect & Sync
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collection Inspector & Full Collection Importer Modal */}
          {collectionPreview && (
            <div className="p-5 rounded-2xl bg-neutral-900 border border-amber-500/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={collectionPreview.cover_url}
                    alt={collectionPreview.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-xl object-cover bg-neutral-800"
                  />
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {collectionPreview.type} Collection Inspector
                    </span>
                    <h4 className="text-base font-extrabold text-white mt-0.5">{collectionPreview.title}</h4>
                    <p className="text-xs text-neutral-400">
                      {collectionPreview.artist} · {(collectionPreview.tracks || []).length} tracks found
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImportEntireCollection}
                    disabled={isBulkImporting || isLoadingCollection || (collectionPreview.tracks || []).length === 0}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isBulkImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>Import Entire {collectionPreview.type} ({(collectionPreview.tracks || []).length} Songs)</span>
                  </button>
                  <button
                    onClick={() => setCollectionPreview(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isLoadingCollection ? (
                <div className="py-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Fetching collection tracklist...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {(collectionPreview.tracks || []).map((trk: any, i: number) => (
                    <div key={trk.videoId || trk.id || i} className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-between gap-2 text-xs">
                      <div className="truncate">
                        <span className="font-mono text-neutral-500 mr-2">{i + 1}.</span>
                        <span className="font-semibold text-white">{trk.title}</span>
                      </div>
                      <button
                        onClick={() => handleImportYouTubeSong({ ...trk, album: collectionPreview.title, artist: trk.artist || collectionPreview.artist, cover_url: trk.cover_url || collectionPreview.cover_url })}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] shrink-0"
                      >
                        Import
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Automated Criteria Import & Scheduled Metadata Synchronization + Authorized Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Automated Search Criteria & Scheduled Sync */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Automated Import & Scheduled Metadata Sync ({dbImportSchedules.length})</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure automated search rules by genre, country, and release year to ingest and sync tracks automatically.
                </p>
              </div>

              <form onSubmit={handleCreateSchedule} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <input
                  type="text"
                  required
                  value={schName}
                  onChange={(e) => setSchName(e.target.value)}
                  placeholder="Rule Name (e.g. Top Afrobeats 2025)"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
                <input
                  type="text"
                  required
                  value={schQuery}
                  onChange={(e) => setSchQuery(e.target.value)}
                  placeholder="Search Criteria (e.g. Afrobeats hits)"
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                />
                <select
                  value={schGenre}
                  onChange={(e) => setSchGenre(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  {['Afrobeats', 'Pop', 'Hip-Hop', 'R&B', 'Amapiano', 'Electronic', 'Lo-Fi'].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  value={schCountry}
                  onChange={(e) => setSchCountry(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  {['NG', 'US', 'GB', 'ZA', 'GH', 'KE', 'CA'].map((c) => (
                    <option key={c} value={c}>Country: {c}</option>
                  ))}
                </select>
                <select
                  value={schFrequency}
                  onChange={(e) => setSchFrequency(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                >
                  <option value="hourly">Run Hourly</option>
                  <option value="daily">Run Daily</option>
                  <option value="weekly">Run Weekly</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer"
                >
                  + Save Auto-Sync Rule
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {dbImportSchedules.map((sch) => (
                  <div key={sch.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sch.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${Number(sch.is_active) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-neutral-400'}`}>
                          {Number(sch.is_active) ? sch.frequency : 'Paused'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        Query: "{sch.search_query}" · {sch.genre} · {sch.country} · Total synced: {sch.total_imported || 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRunScheduleNow(sch.id)}
                        disabled={runningScheduleId === sch.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {runningScheduleId === sch.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        <span>Run Now</span>
                      </button>
                      <button
                        onClick={async () => {
                          await api.toggleImportSchedule(sch.id);
                          fetchAdminData();
                        }}
                        className="px-2 py-1 rounded-lg bg-white/10 text-neutral-300"
                      >
                        {Number(sch.is_active) ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={async () => {
                          await api.deleteImportSchedule(sch.id);
                          fetchAdminData();
                        }}
                        className="text-red-400 hover:underline px-1.5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Authorized Audio & Artwork File Upload Sync */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Authorized Master Audio & Artwork File Manager Upload</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Upload authorized audio files (.mp3, .m4a, .wav, .flac) or artwork (.jpg, .png, .webp) directly into protected server storage and sync with releases.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-neutral-400 mb-1">Sync With Existing Track (Optional)</label>
                    <select
                      value={uploadTargetTrackId}
                      onChange={(e) => setUploadTargetTrackId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                    >
                      <option value="">-- Standalone Upload or Select Track --</option>
                      {dbTracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} — {t.artist_name} ({t.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1">Media Asset Type</label>
                    <select
                      value={uploadMediaType}
                      onChange={(e) => setUploadMediaType(e.target.value as 'audio' | 'artwork')}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
                    >
                      <option value="audio">Master Audio File (.mp3, .m4a, .wav, .flac)</option>
                      <option value="artwork">Cover Artwork Image (.jpg, .png, .webp)</option>
                    </select>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 hover:border-amber-500/50 rounded-2xl bg-neutral-950/60 cursor-pointer transition-colors">
                  {isUploadingFile ? (
                    <div className="flex items-center gap-2 text-amber-400 font-semibold">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading & validating file into Flontmie server storage...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-amber-400 mb-2" />
                      <span className="font-bold text-white">Click to select authorized {uploadMediaType} file</span>
                      <span className="text-[11px] text-neutral-500 mt-1">
                        Stored in protected server directories and streamed via /phpbackend/api/stream.php
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={uploadMediaType === 'audio' ? '.mp3,.m4a,.wav,.flac,.ogg,audio/*' : '.jpg,.jpeg,.png,.webp,image/*'}
                    onChange={handleAuthorizedMediaUpload}
                    disabled={isUploadingFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 3. Import Pipeline History, Duplicate Detection & Retry/Cancel Controls */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Import History, Audio Acquisition Telemetry & Retry Controls ({dbImportJobs.length})
                </h3>
                <p className="text-xs text-neutral-400">
                  Tracks every individual, bulk, and scheduled import with duplicate prevention, local storage status, and retry/cancel actions.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Time & Job ID</th>
                    <th className="py-3 px-4">Content & Source ID</th>
                    <th className="py-3 px-4">Metadata</th>
                    <th className="py-3 px-4">Audio Pipeline</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Retry / Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbImportJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400">
                        <span className="text-white block">{job.id}</span>
                        <span>{job.created_at}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-white">{job.title}</p>
                        <p className="text-[11px] text-neutral-400">
                          {job.artist_name} · Source: <code className="text-amber-300">{job.source_id}</code>
                        </p>
                      </td>
                      <td className="py-2.5 px-4 text-neutral-300">
                        <span>{job.genre} · {job.country} · {job.release_year}</span>
                        <span className="block text-[10px] font-mono text-neutral-500">{job.license_status}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px]">
                        <span className="text-emerald-400 block">{job.audio_method || 'synced'}</span>
                        <span className="text-neutral-500">
                          {job.file_size_bytes ? `${Math.round(Number(job.file_size_bytes) / 1024)} KB` : 'Hosted'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            job.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : job.status === 'duplicate_skipped'
                              ? 'bg-blue-500/20 text-blue-300'
                              : job.status === 'cancelled'
                              ? 'bg-neutral-700 text-neutral-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {job.status}
                        </span>
                        {job.error_message && (
                          <p className="text-[10px] text-red-400 mt-0.5 max-w-xs truncate">{job.error_message}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={async () => {
                            try {
                              const res = await api.retryImportJob(job.id);
                              showNotice(res.message || 'Retried import job.');
                              fetchAdminData();
                            } catch (err: any) {
                              setError(err?.message || 'Retry failed.');
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Retry Audio Acquisition & Metadata Sync"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                        {job.status !== 'cancelled' && (
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.cancelImportJob(job.id);
                                showNotice(res.message || 'Job cancelled.');
                                fetchAdminData();
                              } catch (err: any) {
                                setError(err?.message || 'Cancel failed.');
                              }
                            }}
                            className="px-2 py-1 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Cancel Import Job"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: DISTRIBUTORS & LABELS */}
      {activeSection === 'distributors_labels' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distributors */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-purple-400" />
                <span>Partner Distributors ({dbDistributors.length})</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {dbDistributors.map((d) => (
                  <div key={d.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{d.name}</p>
                      <p className="text-[11px] text-neutral-400">{d.contact_email} · {d.quota_type}</p>
                    </div>
                    <select
                      value={d.status || 'active'}
                      onChange={async (e) => {
                        await api.updateAdminDistributor({ id: d.id, status: e.target.value });
                        fetchAdminData();
                      }}
                      className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs text-white"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                ))}
              </div>
              <form onSubmit={handleCreateDistributor} className="pt-2 flex gap-2">
                <input
                  type="text"
                  value={newDistName}
                  onChange={(e) => setNewDistName(e.target.value)}
                  placeholder="New Distributor Name"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white"
                />
                <input
                  type="email"
                  value={newDistEmail}
                  onChange={(e) => setNewDistEmail(e.target.value)}
                  placeholder="Contact Email"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white"
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold">
                  Add
                </button>
              </form>
            </div>

            {/* Record Labels */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Registered Record Labels ({dbLabels.length})</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {dbLabels.map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{l.name}</p>
                      <p className="text-[11px] text-neutral-400">{l.contact_email} · {l.country}</p>
                    </div>
                    <select
                      value={l.status || 'active'}
                      onChange={async (e) => {
                        await api.updateAdminLabel({ id: l.id, status: e.target.value, country: l.country });
                        fetchAdminData();
                      }}
                      className="px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs text-white"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                ))}
              </div>
              <form onSubmit={handleCreateLabel} className="pt-2 flex gap-2">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="New Label Name"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white"
                />
                <input
                  type="email"
                  value={newLabelEmail}
                  onChange={(e) => setNewLabelEmail(e.target.value)}
                  placeholder="Contact Email"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/10 text-xs text-white"
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold">
                  Add
                </button>
              </form>
            </div>
          </div>

          {/* Role Permissions Matrix */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Role Upload & Permissions Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-center">Direct Upload</th>
                    <th className="py-3 px-4 text-center">Edit Metadata</th>
                    <th className="py-3 px-4 text-center">Manage Roster</th>
                    <th className="py-3 px-4 text-center">Monthly Quota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbRolePermissions.map((rp) => (
                    <tr key={rp.role}>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">{rp.name}</span>
                        <span className="text-[11px] text-neutral-400">{rp.description}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(Number(rp.can_direct_upload))}
                          onChange={async (e) => {
                            await api.updateAdminRolePermission({ ...rp, can_direct_upload: e.target.checked });
                            fetchAdminData();
                          }}
                          className="accent-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(Number(rp.can_edit_live_metadata))}
                          onChange={async (e) => {
                            await api.updateAdminRolePermission({ ...rp, can_edit_live_metadata: e.target.checked });
                            fetchAdminData();
                          }}
                          className="accent-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(Number(rp.can_manage_roster))}
                          onChange={async (e) => {
                            await api.updateAdminRolePermission({ ...rp, can_manage_roster: e.target.checked });
                            fetchAdminData();
                          }}
                          className="accent-amber-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-white">{rp.max_upload_per_month}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: MODERATION */}
      {activeSection === 'moderation' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Copyright, Impersonation & Content Moderation Queue ({dbReports.length})</h3>
            <div className="space-y-3">
              {dbReports.map((rep) => (
                <div key={rep.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase text-[10px]">
                        {rep.category}
                      </span>
                      <span className="font-bold text-white">{rep.target_name}</span>
                      <span className="text-neutral-400 font-mono">({rep.target_type}: {rep.target_id})</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-neutral-200 uppercase text-[10px]">
                        {rep.status}
                      </span>
                    </div>
                    <p className="text-neutral-300">{rep.reason}</p>
                    <p className="text-[11px] text-neutral-500">Reporter: {rep.reporter_email} · {rep.created_at}</p>
                    <input
                      type="text"
                      value={repNotesMap[rep.id] ?? rep.resolution_notes ?? ''}
                      onChange={(e) => setRepNotesMap({ ...repNotesMap, [rep.id]: e.target.value })}
                      placeholder="Resolution notes..."
                      className="mt-1 w-full max-w-md px-2.5 py-1 rounded bg-neutral-950 border border-white/10 text-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleResolveReport(rep.id, 'resolved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => handleResolveReport(rep.id, 'resolved', 'unpublish_track')}
                      className="px-3 py-1.5 rounded-lg bg-red-600/25 border border-red-500/40 text-red-300 font-semibold"
                    >
                      Flag Target Content
                    </button>
                    <button
                      onClick={() => handleResolveReport(rep.id, 'dismissed')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 text-neutral-300 font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateReport} className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Log New Moderation / Copyright Case</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <select
                value={repCategory}
                onChange={(e) => setRepCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              >
                <option value="copyright">Copyright Complaint</option>
                <option value="impersonation">Artist Impersonation</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="dispute">Ownership Dispute</option>
                <option value="appeal">Account Appeal</option>
              </select>
              <select
                value={repTargetType}
                onChange={(e) => setRepTargetType(e.target.value)}
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              >
                <option value="track">Track</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="playlist">Playlist</option>
                <option value="user">User</option>
              </select>
              <input
                type="text"
                required
                value={repTargetName}
                onChange={(e) => setRepTargetName(e.target.value)}
                placeholder="Target Name / Title"
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
              <input
                type="text"
                required
                value={repReason}
                onChange={(e) => setRepReason(e.target.value)}
                placeholder="Detailed complaint or reason..."
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs">
              Submit Moderation Case
            </button>
          </form>
        </div>
      )}

      {/* SECTION 7: ANALYTICS */}
      {activeSection === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Genre Stream Distribution */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Streams & Release Volume by Genre</span>
              </h3>
              <div className="space-y-3 text-xs">
                {(dbAnalytics?.genre_stats || []).map((g: any) => (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-white">{g.genre} ({g.track_count} songs)</span>
                      <span className="font-mono text-neutral-400">{(Number(g.total_streams) || 0).toLocaleString()} plays</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Account Role Breakdown */}
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white">User Growth & Account Role Distribution</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {(dbAnalytics?.role_breakdown || []).map((rb: any) => (
                  <div key={rb.role} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                    <span className="capitalize font-semibold text-neutral-200">{rb.role}s</span>
                    <span className="text-lg font-extrabold font-mono text-amber-400">{rb.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Popular Songs */}
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Most Streamed Songs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {(dbAnalytics?.top_tracks || dbTracks.slice(0, 8)).map((t: any, i: number) => (
                <div key={t.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-amber-400 w-5">#{i + 1}</span>
                    <img src={t.cover_art_url} alt={t.title} className="w-9 h-9 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{t.title}</p>
                      <p className="text-neutral-400 truncate">{t.artist_name}</p>
                    </div>
                  </div>
                  <span className="font-mono text-emerald-400">{(Number(t.stream_count) || 0).toLocaleString()} plays</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: PLAYLISTS & GENRES */}
      {activeSection === 'playlists_genres' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Featured Editorial Playlists & Homepage Carousels ({dbPlaylists.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {dbPlaylists.map((pl) => (
                <div key={pl.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={pl.cover_art_url} alt={pl.title} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{pl.title}</p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        Category: {pl.genre_category || 'all'} · {(pl.track_ids || []).length} tracks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleUpdatePlaylist(pl.id, { is_featured: !Number(pl.is_featured ?? 1) })}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        Number(pl.is_featured ?? 1) ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-neutral-400'
                      }`}
                    >
                      {Number(pl.is_featured ?? 1) ? 'Featured' : 'Standard'}
                    </button>
                    <button
                      onClick={() => handleUpdatePlaylist(pl.id, { delete: true })}
                      className="text-red-400 hover:underline px-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white">Platform Genres & Mood Categories ({dbGenres.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {dbGenres.map((g) => (
                <div key={g.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{g.name}</span>
                    <span className="text-[10px] font-mono text-amber-400">#{g.display_order}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{g.description}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveGenre} className="pt-2 flex flex-wrap gap-2 text-xs">
              <input
                type="text"
                required
                value={newGenreName}
                onChange={(e) => setNewGenreName(e.target.value)}
                placeholder="Genre Name (e.g. Amapiano)"
                className="px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
              <input
                type="text"
                value={newGenreDesc}
                onChange={(e) => setNewGenreDesc(e.target.value)}
                placeholder="Description"
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
              <input
                type="number"
                value={newGenreOrder}
                onChange={(e) => setNewGenreOrder(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold">
                Add / Save Genre
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 9: SYSTEM SETTINGS */}
      {activeSection === 'settings' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-neutral-900/40 border border-white/[0.08] space-y-5 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-white">Platform Configuration & System Rules</h3>
            <p className="text-xs text-neutral-400">All settings are persisted in system storage and enforced on the backend.</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-neutral-300 mb-1">Platform Display Name</label>
              <input
                type="text"
                value={dbSettings.platform_name ?? 'SoundPulse Music Streaming & Industry Hub'}
                onChange={(e) => setDbSettings({ ...dbSettings, platform_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white"
              />
            </div>

            {[
              { key: 'maintenance_mode', label: 'Maintenance Mode (Restrict access to Administrators only)' },
              { key: 'allow_public_registration', label: 'Allow Public Account Registration' },
              { key: 'require_email_verification', label: 'Require Email Verification for New Accounts' },
              { key: 'allow_artist_claims', label: 'Allow Artist Profile Verification Claims' },
              { key: 'youtube_music_discovery_enabled', label: 'Enable Real-Time Music Discovery & Playback' },
              { key: 'social_jam_sessions_enabled', label: 'Enable Live Social Jam Listening Rooms' },
              { key: 'direct_distributor_ingestion', label: 'Allow Partner Distributor Direct Ingestion' },
            ].map((toggle) => (
              <label key={toggle.key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] cursor-pointer">
                <span className="font-medium text-neutral-200">{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={(dbSettings[toggle.key] ?? 'false') === 'true'}
                  onChange={(e) => setDbSettings({ ...dbSettings, [toggle.key]: e.target.checked ? 'true' : 'false' })}
                  className="accent-amber-500 w-4 h-4"
                />
              </label>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Max Failed Login Attempts Before Lockout</label>
                <input
                  type="number"
                  value={dbSettings.max_login_attempts ?? '5'}
                  onChange={(e) => setDbSettings({ ...dbSettings, max_login_attempts: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-neutral-300 mb-1">Session Lifetime (Days)</label>
                <input
                  type="number"
                  value={dbSettings.session_lifetime_days ?? '30'}
                  onChange={(e) => setDbSettings({ ...dbSettings, session_lifetime_days: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs">
            Save System Configuration
          </button>
        </form>
      )}

      {/* SECTION 10: AUDIT LOGS */}
      {activeSection === 'audit_logs' && (
        <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white">Immutable Administrator & Platform Audit Trail ({dbAuditLogs.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {dbAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">{log.created_at}</td>
                    <td className="py-2.5 px-4 text-white">{log.user_email || log.user_id || 'System'}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-400">{log.action}</td>
                    <td className="py-2.5 px-4 text-neutral-300">{log.entity_type} · {log.entity_id}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400 max-w-xs truncate">{log.details_json}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-500">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 11: SECURITY */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          {/* Active Sessions */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Server-Side Active Sessions ({dbSessions.length})</span>
                </h3>
                <p className="text-xs text-neutral-400">Manage authenticated sessions and revoke suspicious tokens immediately</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Session ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">IP & Agent</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbSessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-300">{s.id}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white">{s.email || s.user_id}</span>
                        <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">{s.role}</span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-neutral-400 max-w-xs truncate">
                        {s.ip_address} · {s.user_agent}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-400">{s.last_active_at}</td>
                      <td className="py-3 px-4">
                        {Number(s.is_revoked) ? (
                          <span className="text-red-400 font-mono text-[11px]">Revoked</span>
                        ) : (
                          <span className="text-emerald-400 font-mono text-[11px]">Active</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!Number(s.is_revoked) && (
                          <button
                            onClick={async () => {
                              await api.revokeAdminSession({ session_id: s.id });
                              showNotice(`Session ${s.id} revoked.`);
                              fetchAdminData();
                            }}
                            className="px-2.5 py-1 rounded bg-red-500/20 text-red-300 text-[11px] font-semibold"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Login History & Security Events */}
          <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-neutral-900/30">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-white">Security Events, Login History & Suspicious Activity ({dbSecurityEvents.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.02] text-neutral-400 uppercase text-[11px] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {dbSecurityEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400">{ev.created_at}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white">{ev.event_type}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ev.severity === 'warning' || ev.severity === 'critical'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}>
                          {ev.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-neutral-300">{ev.email || ev.user_id || 'Anonymous'}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400">{ev.ip_address}</td>
                      <td className="py-2.5 px-4 text-neutral-400">{ev.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
