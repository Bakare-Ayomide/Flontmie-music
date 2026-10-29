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
  Loader2,
  RefreshCw,
  Lock,
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
  Disc3,
  RotateCcw,
  Ban,
  FolderSearch,
  Heart,
  MessageSquare,
  Eye,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Track,
  LabelArtist,
  AdminRolePermission,
} from '../../types/music';
import { api } from '../../services/api';
import { AuthUser } from '../auth/AuthModal';
import { MediaScannerAdmin } from './MediaScannerAdmin';
import { FlontmieGeometricMark } from '../auth/FlontmieOnboarding';

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
  | 'users'
  | 'user_activity'
  | 'engagement'
  | 'playlists_genres'
  | 'catalog'
  | 'ytmusic_import'
  | 'media_scanner'
  | 'artists_claims'
  | 'distributors_labels'
  | 'moderation'
  | 'analytics'
  | 'security'
  | 'audit_logs'
  | 'settings';

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

  // User Management Filters & Create/Edit/Delete States
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('listener');
  const [newUserCountry, setNewUserCountry] = useState('NG');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [userPendingDelete, setUserPendingDelete] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingUserPassword, setEditingUserPassword] = useState('');
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);

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
  const [newLabelCountry, setNewLabelCountry] = useState('NG');

  // Artist creation form
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistCountry, setNewArtistCountry] = useState('NG');
  const [newArtistAvatar, setNewArtistAvatar] = useState('');

  // Server Storage & Bulk Catalog State
  const [importProgressMsg, setImportProgressMsg] = useState<string | null>(null);
  const [dbImportJobs, setDbImportJobs] = useState<any[]>([]);
  const [dbImportSchedules, setDbImportSchedules] = useState<any[]>([]);
  const [dbStorage, setDbStorage] = useState<any>(null);
  const [selectedCatalogTrackIds, setSelectedCatalogTrackIds] = useState<string[]>([]);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);

  // Authorized Audio / Artwork Upload State
  const [uploadTargetTrackId, setUploadTargetTrackId] = useState('');
  const [uploadMediaType, setUploadMediaType] = useState<'audio' | 'artwork'>('audio');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Admin Direct Track Release Creation Form
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackAlbum, setNewTrackAlbum] = useState('Single');
  const [newTrackGenre, setNewTrackGenre] = useState('Afrobeats');
  const [newTrackLyrics, setNewTrackLyrics] = useState('');
  const [newTrackAudioFile, setNewTrackAudioFile] = useState<File | null>(null);
  const [newTrackVideoFile, setNewTrackVideoFile] = useState<File | null>(null);
  const [newTrackLyricsFile, setNewTrackLyricsFile] = useState<File | null>(null);
  const [newTrackArtworkFile, setNewTrackArtworkFile] = useState<File | null>(null);
  const [isCreatingDirectTrack, setIsCreatingDirectTrack] = useState(false);

  // Admin Visibility: Playlists, Playlist Contents, User Activity, User Profile Inspector & Engagement
  const [adminPlaylists, setAdminPlaylists] = useState<any[]>([]);
  const [playlistTotal, setPlaylistTotal] = useState(0);
  const [playlistTotalPages, setPlaylistTotalPages] = useState(1);
  const [playlistPage, setPlaylistPage] = useState(1);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [playlistCreatorType, setPlaylistCreatorType] = useState<'all' | 'admin' | 'user'>('all');
  const [playlistVisibility, setPlaylistVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [playlistSummary, setPlaylistSummary] = useState<any>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  // Playlist Detail Inspector Modal
  const [selectedPlaylistDetail, setSelectedPlaylistDetail] = useState<any | null>(null);
  const [loadingPlaylistDetail, setLoadingPlaylistDetail] = useState(false);

  // User Activities State
  const [adminActivities, setAdminActivities] = useState<any[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState(0);
  const [activitiesTotalPages, setActivitiesTotalPages] = useState(1);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityUserFilter, setActivityUserFilter] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [activityTargetTypeFilter, setActivityTargetTypeFilter] = useState('');
  const [activityDateFrom, setActivityDateFrom] = useState('');
  const [activityDateTo, setActivityDateTo] = useState('');
  const [availableActionTypes, setAvailableActionTypes] = useState<string[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // User Profile Detail Modal State
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [userDetailTab, setUserDetailTab] = useState<'activity' | 'playlists' | 'likes' | 'comments' | 'follows' | 'uploads'>('activity');
  const [userDetailActType, setUserDetailActType] = useState('');
  const [userDetailDateFrom, setUserDetailDateFrom] = useState('');
  const [userDetailDateTo, setUserDetailDateTo] = useState('');
  const [userDetailPage, setUserDetailPage] = useState(1);

  // Engagement (Likes & Comments) State
  const [engagementData, setEngagementData] = useState<any | null>(null);
  const [engagementTab, setEngagementTab] = useState<'tracks' | 'likes' | 'comments'>('tracks');
  const [engagementSearch, setEngagementSearch] = useState('');
  const [engagementPage, setEngagementPage] = useState(1);
  const [loadingEngagement, setLoadingEngagement] = useState(false);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const fetchAdminPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const res = await api.getAdminPlaylists({
        q: playlistSearch.trim() || undefined,
        creator_type: playlistCreatorType,
        visibility: playlistVisibility,
        page: playlistPage,
        per_page: 15,
      });
      if (res && res.status === 'success') {
        setAdminPlaylists(res.playlists || []);
        setPlaylistTotal(Number(res.total) || 0);
        setPlaylistTotalPages(Number(res.total_pages) || 1);
        setPlaylistSummary(res.summary || null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPlaylists(false);
    }
  }, [playlistSearch, playlistCreatorType, playlistVisibility, playlistPage]);

  const handleOpenPlaylistDetail = async (playlistId: string) => {
    setLoadingPlaylistDetail(true);
    try {
      const res = await api.getAdminPlaylistDetail(playlistId);
      if (res && res.status === 'success') {
        setSelectedPlaylistDetail(res);
      } else {
        setError('Could not load playlist contents.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load playlist contents.');
    } finally {
      setLoadingPlaylistDetail(false);
    }
  };

  const fetchAdminActivitiesList = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const res = await api.getAdminActivities({
        q: activitySearch.trim() || undefined,
        user_id: activityUserFilter || undefined,
        action_type: activityTypeFilter || undefined,
        target_type: activityTargetTypeFilter || undefined,
        date_from: activityDateFrom || undefined,
        date_to: activityDateTo || undefined,
        page: activitiesPage,
        per_page: 25,
      });
      if (res && res.status === 'success') {
        setAdminActivities(res.activities || []);
        setActivitiesTotal(Number(res.total) || 0);
        setActivitiesTotalPages(Number(res.total_pages) || 1);
        if (Array.isArray(res.action_types)) {
          setAvailableActionTypes(res.action_types);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivities(false);
    }
  }, [activitySearch, activityUserFilter, activityTypeFilter, activityTargetTypeFilter, activityDateFrom, activityDateTo, activitiesPage]);

  const handleOpenUserDetail = useCallback(async (userId: string, opts?: { action_type?: string; date_from?: string; date_to?: string; page?: number }) => {
    if (!userId) return;
    setLoadingUserDetail(true);
    try {
      const actType = opts?.action_type !== undefined ? opts.action_type : userDetailActType;
      const dFrom = opts?.date_from !== undefined ? opts.date_from : userDetailDateFrom;
      const dTo = opts?.date_to !== undefined ? opts.date_to : userDetailDateTo;
      const pg = opts?.page !== undefined ? opts.page : userDetailPage;
      const res = await api.getAdminUserDetail({
        user_id: userId,
        action_type: actType || undefined,
        date_from: dFrom || undefined,
        date_to: dTo || undefined,
        page: pg,
        per_page: 20,
      });
      if (res && res.status === 'success') {
        setSelectedUserDetail(res);
      } else {
        setError('Could not load user profile & creations.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load user profile details.');
    } finally {
      setLoadingUserDetail(false);
    }
  }, [userDetailActType, userDetailDateFrom, userDetailDateTo, userDetailPage]);

  const fetchAdminEngagementData = useCallback(async () => {
    setLoadingEngagement(true);
    try {
      const res = await api.getAdminEngagement({
        q: engagementSearch.trim() || undefined,
        page: engagementPage,
        per_page: 25,
      });
      if (res && res.status === 'success') {
        setEngagementData(res);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEngagement(false);
    }
  }, [engagementSearch, engagementPage]);

  const handleDeleteAdminComment = async (commentId: string) => {
    try {
      const res = await api.deleteAdminComment(commentId);
      showNotice(res.message || 'Comment deleted and count reconciled.');
      fetchAdminEngagementData();
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete comment.');
    }
  };

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminDashboard();
      if (data && data.status === 'success') {
        setStats(data.stats || data.metrics || {});
        setDbUsers(data.users || []);
        setDbArtists(data.artists || []);
        setDbClaims(data.claims || []);
        setDbTracks(data.tracks || []);
        setDbAlbums(data.albums || []);
        setDbPlaylists(data.playlists || []);
        setDbDistributors(data.distributors || []);
        setDbLabels(data.labels || []);
        setDbRolePermissions(data.role_permissions || []);
        setDbReports(data.reports || data.flags || []);
        setDbGenres(data.genres || []);
        setDbImportJobs(data.import_jobs || []);
        setDbImportSchedules(data.import_schedules || []);
        setDbStorage(data.storage || null);
        setDbAuditLogs(data.audit_logs || []);
        setDbSessions(data.sessions || data.active_sessions || []);
        setDbSecurityEvents(data.security_events || []);
        setDbAnalytics(data.analytics || {});

        const settingsMap: Record<string, string> = {};
        if (Array.isArray(data.settings)) {
          data.settings.forEach((s: any) => {
            settingsMap[s.setting_key] = s.setting_value;
          });
        } else if (data.settings && typeof data.settings === 'object') {
          Object.assign(settingsMap, data.settings);
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

  useEffect(() => {
    if (activeSection === 'playlists_genres') {
      fetchAdminPlaylists();
    } else if (activeSection === 'user_activity') {
      fetchAdminActivitiesList();
    } else if (activeSection === 'engagement') {
      fetchAdminEngagementData();
    }
  }, [activeSection, fetchAdminPlaylists, fetchAdminActivitiesList, fetchAdminEngagementData]);

  // --- User Management Handlers ---
  const handleUpdateUser = async (
    userId: string,
    updates: {
      role?: string;
      status?: 'active' | 'suspended' | 'banned';
      email_verified?: boolean;
      display_name?: string;
      email?: string;
      new_password?: string;
    }
  ) => {
    try {
      const res = await api.updateAdminUser({ user_id: userId, ...updates } as any);
      showNotice(res.message || 'User account updated.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user.');
    }
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUserEdit(true);
    setError(null);
    try {
      const payload: any = {
        user_id: editingUser.id,
        display_name: editingUser.display_name,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status || 'active',
      };
      if (editingUserPassword.trim().length >= 6) {
        payload.new_password = editingUserPassword.trim();
      }
      const res = await api.updateAdminUser(payload);
      showNotice(res.message || `Updated user ${editingUser.display_name}.`);
      setEditingUser(null);
      setEditingUserPassword('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save user changes.');
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword) {
      setError('Email address and password are required.');
      return;
    }
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setIsCreatingUser(true);
    setError(null);
    try {
      const res = await api.createAdminUser({
        email: newUserEmail.trim(),
        display_name: newUserName.trim() || newUserEmail.split('@')[0],
        password: newUserPassword,
        role: newUserRole,
        country: newUserCountry || 'NG',
        must_change_password: false,
      });
      showNotice(res.message || 'User account created.');
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('listener');
      setIsCreateUserModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Could not create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    setIsDeletingUser(true);
    setError(null);
    try {
      const res = await api.deleteAdminUser(userPendingDelete.id);
      showNotice(res.message || `User ${userPendingDelete.email} permanently deleted.`);
      if (selectedUserDetail?.user?.id === userPendingDelete.id) {
        setSelectedUserDetail(null);
      }
      setUserPendingDelete(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user account.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let out = '';
    for (let i = 0; i < 12; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(out);
  };

  // --- Catalog, Claims, Labels & Settings Handlers ---
  const handleReviewClaim = async (claimId: string, decision: 'approved' | 'rejected' | 'escalated' | 'disputed') => {
    try {
      const res = await api.reviewAdminClaim({
        claim_id: claimId,
        decision,
        notes: claimNotes[claimId] || `Reviewed by administrator (${decision})`,
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

  const handleCreateArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtistName.trim()) return;
    try {
      const res = await api.createAdminArtist({
        name: newArtistName.trim(),
        country: newArtistCountry || 'NG',
        avatar_url: newArtistAvatar.trim() || undefined,
        verified: true,
      });
      showNotice(res.message || `Created artist ${newArtistName}.`);
      setNewArtistName('');
      setNewArtistAvatar('');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Could not create artist.');
    }
  };

  const handleDeleteArtist = async (artistId: string) => {
    try {
      const res = await api.deleteAdminArtist(artistId);
      showNotice(res.message || 'Artist profile deleted.');
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Could not delete artist.');
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
        can_edit_metadata: true,
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
        can_manage_roster: true,
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
        enforce_action: enforceAction,
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
        target_id: repTargetId.trim() || 'trk_custom',
        target_name: repTargetName.trim(),
        category: repCategory,
        reason: repReason.trim(),
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
      fetchAdminPlaylists();
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
        display_order: Number(newGenreOrder) || 9,
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

  const handleCreateDirectAdminRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrackTitle.trim() || !newTrackArtist.trim()) {
      setError('Song title and artist name are required.');
      return;
    }
    if (!newTrackAudioFile && !newTrackVideoFile) {
      setError('Please select at least an audio master file or a music video file to upload.');
      return;
    }
    setIsCreatingDirectTrack(true);
    setImportProgressMsg(`Uploading master release "${newTrackTitle}" (${newTrackArtist}) into Flontmie storage...`);
    setError(null);
    try {
      const res = await api.uploadTrack({
        title: newTrackTitle.trim(),
        artist: newTrackArtist.trim(),
        album: newTrackAlbum.trim() || 'Single',
        genre: newTrackGenre || 'Afrobeats',
        lyrics: newTrackLyrics.trim() || undefined,
        audioFile: newTrackAudioFile,
        videoFile: newTrackVideoFile,
        lyricsFile: newTrackLyricsFile,
        artworkFile: newTrackArtworkFile,
      });
      if (res && res.track && onTrackImported) {
        onTrackImported(res.track);
      }
      showNotice(res.message || `Uploaded "${newTrackTitle}" directly to server catalog.`);
      setNewTrackTitle('');
      setNewTrackArtist('');
      setNewTrackAlbum('Single');
      setNewTrackLyrics('');
      setNewTrackAudioFile(null);
      setNewTrackVideoFile(null);
      setNewTrackLyricsFile(null);
      setNewTrackArtworkFile(null);
      fetchAdminData();
    } catch (err: any) {
      setError(err?.message || 'Direct track upload failed.');
    } finally {
      setIsCreatingDirectTrack(false);
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

  const navGroups: {
    groupTitle: string;
    items: { id: AdminSection; label: string; icon: React.ReactNode; count?: number }[];
  }[] = [
    {
      groupTitle: 'Command & People',
      items: [
        { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
        { id: 'users', label: 'Users & Accounts', icon: <Users className="w-4 h-4" />, count: stats?.total_users ?? dbUsers.length },
        { id: 'user_activity', label: 'User Activity', icon: <Clock className="w-4 h-4" />, count: stats?.total_activities },
        { id: 'engagement', label: 'Likes & Comments', icon: <Heart className="w-4 h-4" />, count: (Number(stats?.total_likes) || 0) + (Number(stats?.total_comments) || 0) },
      ],
    },
    {
      groupTitle: 'Catalog & Media',
      items: [
        { id: 'catalog', label: 'Music Releases', icon: <Music className="w-4 h-4" />, count: stats?.total_tracks ?? dbTracks.length },
        { id: 'ytmusic_import', label: 'Upload & Storage', icon: <Upload className="w-4 h-4" />, count: dbStorage?.audio_files_count ?? dbTracks.length },
        { id: 'media_scanner', label: 'Media Matcher', icon: <FolderSearch className="w-4 h-4" />, count: stats?.media_counts?.ambiguous || undefined },
        { id: 'playlists_genres', label: 'Playlists & Genres', icon: <ListMusic className="w-4 h-4" />, count: stats?.total_playlists ?? dbPlaylists.length },
      ],
    },
    {
      groupTitle: 'Partners & Rights',
      items: [
        { id: 'artists_claims', label: 'Artists & Claims', icon: <UserCheck className="w-4 h-4" />, count: stats?.pending_claims },
        { id: 'distributors_labels', label: 'Distributors & Labels', icon: <Network className="w-4 h-4" /> },
        { id: 'moderation', label: 'Moderation', icon: <Flag className="w-4 h-4" />, count: stats?.open_reports },
      ],
    },
    {
      groupTitle: 'System & Security',
      items: [
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'security', label: 'Sessions & Security', icon: <Lock className="w-4 h-4" />, count: dbSessions.length },
        { id: 'audit_logs', label: 'Audit Trail', icon: <FileText className="w-4 h-4" /> },
        { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);
  const activeNavItem = allNavItems.find((i) => i.id === activeSection) || allNavItems[0];

  return (
    <div className="min-h-screen text-neutral-100 pb-28 space-y-6">
      {/* TOP BAR CONTRACT: Brand & Context | Quick Actions */}
      <header className="p-4 sm:p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#D8D3C8] flex items-center justify-center shrink-0">
            <FlontmieGeometricMark className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="font-semibold text-white">Flontmie Admin</span>
              <span aria-hidden="true">/</span>
              <span className="text-neutral-300">{activeNavItem.label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-neutral-400 truncate">
                {currentUser?.email || 'Administrator'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5">
              Platform Governance & Operations Console
            </h1>
          </div>
        </div>

        {/* Always-Visible Global Actions (Including Create User!) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setIsCreateUserModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`px-3.5 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'users'
                ? 'bg-white text-black border-white'
                : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Users ({stats?.total_users ?? dbUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ytmusic_import')}
            className="px-3.5 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Release</span>
          </button>

          <button
            type="button"
            onClick={fetchAdminData}
            className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Sync</span>
          </button>

          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-2 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-xs font-semibold text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile / Tablet Horizontal Navigation Bar */}
      <div className="xl:hidden flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/[0.08]">
        {allNavItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-white text-black'
                  : 'bg-[#0D0F16] text-neutral-400 hover:text-white border border-white/[0.06]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {typeof item.count === 'number' && (
                <span className={`font-mono tabular-nums text-[11px] ${active ? 'text-neutral-700' : 'text-neutral-500'}`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN 2-ZONE ENTERPRISE WORKSPACE: Left Navigation Sidebar + Content Viewport */}
      <div className="xl:grid xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-6 items-start">
        {/* Left Navigation Sidebar (Desktop) */}
        <aside className="hidden xl:block sticky top-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] p-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-neutral-500 tracking-wide">
                {group.groupTitle}
              </div>
              {group.items.map((item) => {
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          active ? 'text-neutral-700 font-semibold' : 'text-neutral-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Main Content Viewport */}
        <div className="min-w-0 space-y-6">
          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Executive KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  {
                    label: 'Total Users',
                    val: stats?.total_users ?? dbUsers.length,
                    sub: `${stats?.active_users ?? dbUsers.length} active · ${stats?.suspended_users ?? 0} suspended`,
                    onClick: () => setActiveSection('users'),
                  },
                  {
                    label: 'Music Releases',
                    val: stats?.total_tracks ?? dbTracks.length,
                    sub: `${stats?.total_albums ?? dbAlbums.length} albums · ${stats?.total_artists ?? dbArtists.length} artists`,
                    onClick: () => setActiveSection('catalog'),
                  },
                  {
                    label: 'Playlists',
                    val: stats?.total_playlists ?? dbPlaylists.length,
                    sub: `${stats?.admin_playlists_count ?? 0} admin · ${stats?.user_playlists_count ?? 0} user`,
                    onClick: () => setActiveSection('playlists_genres'),
                  },
                  {
                    label: 'Likes & Comments',
                    val: `${stats?.total_likes ?? 0} / ${stats?.total_comments ?? 0}`,
                    sub: 'Synchronized DB counts',
                    onClick: () => setActiveSection('engagement'),
                  },
                  {
                    label: 'User Activities',
                    val: stats?.total_activities ?? 0,
                    sub: 'Logged platform events',
                    onClick: () => setActiveSection('user_activity'),
                  },
                  {
                    label: 'Total Streams',
                    val: (Number(stats?.total_streams) || 0).toLocaleString(),
                    sub: 'Verified stream count',
                    onClick: () => setActiveSection('analytics'),
                  },
                ].map((card, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={card.onClick}
                    className="p-4 rounded-xl bg-[#0D0F16] hover:bg-[#131622] border border-white/[0.08] text-left transition-colors cursor-pointer space-y-1"
                  >
                    <p className="text-xs text-neutral-400">{card.label}</p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-white">{card.val}</p>
                    <p className="text-[11px] text-neutral-500 font-mono tabular-nums truncate">{card.sub}</p>
                  </button>
                ))}
              </div>

              {/* IMMEDIATE USER DIRECTORY & GOVERNANCE ON OVERVIEW (Create User & Delete User right up front) */}
              <div className="rounded-xl bg-[#0D0F16] border border-white/[0.08] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      User Accounts & Role Governance ({dbUsers.length})
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Create new users, assign roles, inspect user activity, or permanently delete user accounts.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateUserModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create New User</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('users')}
                      className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Open Full User Manager
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">User / Email</th>
                        <th className="py-3 px-4 font-medium">Role</th>
                        <th className="py-3 px-4 font-medium">Activity Summary</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium text-right">Actions (Edit / Delete)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {dbUsers.slice(0, 8).map((u) => {
                        const isSelf = Boolean(currentUser && (u.id === currentUser.id || u.email === currentUser.email));
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{u.display_name || u.username}</div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                {u.email} · @{u.username}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                                className="px-2.5 py-1 rounded-lg bg-[#141722] border border-white/10 text-xs text-white font-medium"
                              >
                                <option value="listener">Listener</option>
                                <option value="artist">Artist</option>
                                <option value="label">Label</option>
                                <option value="distributor">Distributor</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 text-neutral-400 font-mono tabular-nums text-[11px]">
                              {u.playlists_count ?? 0} playlists · {u.likes_count ?? 0} likes · {u.comments_count ?? 0} comments
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs font-medium ${
                                  (u.status || 'active') === 'active' ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {(u.status || 'active') === 'active' ? 'Active' : u.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser({ ...u });
                                  setEditingUserPassword('');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUserDetailTab('activity');
                                  handleOpenUserDetail(u.id, { page: 1 });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setUserPendingDelete(u)}
                                title={isSelf ? 'Cannot delete your own active administrator account' : 'Delete User Account'}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Platform Activity */}
                <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <h3 className="text-sm font-bold text-white">Recent Audit & Admin Activity</h3>
                    <button
                      onClick={() => setActiveSection('audit_logs')}
                      className="text-xs text-purple-400 hover:underline cursor-pointer"
                    >
                      View All Logs
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.05] max-h-80 overflow-y-auto">
                    {(stats?.recent_activity || dbAuditLogs.slice(0, 10)).map((act: any) => (
                      <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-white">{act.action}</span>
                          <p className="text-[11px] text-neutral-400 truncate">
                            {act.actor_email || act.user_email || act.user_id || 'System'} · {act.entity_type}{' '}
                            {act.entity_id ? `(${act.entity_id})` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-neutral-500 shrink-0">
                          {act.created_at}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Governance Priorities */}
                <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                  <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3">
                    Operations & Governance Shortcuts
                  </h3>
                  <div className="divide-y divide-white/[0.06] text-xs">
                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">User Account Provisioning & Deletion</p>
                        <p className="text-[11px] text-neutral-400">
                          {stats?.total_users ?? dbUsers.length} registered accounts across all roles
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveSection('users')}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Manage Users
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">Pending Artist Profile Claims</p>
                        <p className="text-[11px] text-neutral-400">
                          {stats?.pending_claims ?? 0} claims awaiting identity verification
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveSection('artists_claims')}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Review Claims
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">Media-to-Metadata Auto Matcher</p>
                        <p className="text-[11px] text-neutral-400">
                          Scan server storage folders and link audio, video, lyrics & artwork
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveSection('media_scanner')}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Open Matcher
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">Active Authenticated Sessions</p>
                        <p className="text-[11px] text-neutral-400">
                          {dbSessions.length} active sessions tracked in MySQL database
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveSection('security')}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Security Console
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: USERS & ACCOUNTS (Create, Edit, Role, Suspend, Delete, Inspect) */}
          {activeSection === 'users' && (
            <div className="space-y-6">
              {/* Prominent Top Create New User Card */}
              <form
                onSubmit={handleCreateUser}
                className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-purple-400" />
                      <span>Create New User Account</span>
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Provision a new Listener, Artist, Record Label, Distributor, or Administrator account directly in the MySQL database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-neutral-200 cursor-pointer self-start sm:self-auto"
                  >
                    Generate Password
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                  <div className="lg:col-span-1">
                    <label className="block text-neutral-400 mb-1">Display Name *</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Full Name or Artist Name"
                      className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-neutral-400 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-neutral-400 mb-1">Password (min 6 chars) *</label>
                    <input
                      type="text"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Initial password"
                      className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <label className="block text-neutral-400 mb-1">Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    >
                      <option value="listener">Listener</option>
                      <option value="artist">Artist</option>
                      <option value="label">Record Label</option>
                      <option value="distributor">Distributor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="lg:col-span-1 flex items-end gap-2">
                    <div className="w-20">
                      <label className="block text-neutral-400 mb-1">Country</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={newUserCountry}
                        onChange={(e) => setNewUserCountry(e.target.value.toUpperCase())}
                        placeholder="NG"
                        className="w-full px-2.5 py-2 rounded-lg bg-[#141722] border border-white/10 text-white font-mono uppercase text-center"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isCreatingUser}
                      className="flex-1 py-2 px-4 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isCreatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Create</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Search & Filter Toolbar */}
              <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by email, username, or display name..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                >
                  <option value="">All Roles ({dbUsers.length})</option>
                  <option value="admin">Administrators</option>
                  <option value="distributor">Distributors</option>
                  <option value="label">Record Labels</option>
                  <option value="artist">Artists</option>
                  <option value="listener">Listeners</option>
                </select>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              {/* Users Table with Edit, Inspect, Suspend/Restore, and Delete Buttons */}
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Registered Platform Users ({filteredUsers.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCreateUserModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New User Modal</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">User / Email</th>
                        <th className="py-3 px-4 font-medium">Role</th>
                        <th className="py-3 px-4 font-medium">Creations & Engagement</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium">Email Verified</th>
                        <th className="py-3 px-4 font-medium">Last Login</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {filteredUsers.map((u) => {
                        const isSelf = Boolean(currentUser && (u.id === currentUser.id || u.email === currentUser.email));
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{u.display_name || u.username}</div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                {u.email} · @{u.username} {u.country ? `· ${u.country}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={u.role}
                                onChange={(e) => handleUpdateUser(u.id, { role: e.target.value })}
                                className="px-2.5 py-1 rounded-lg bg-[#141722] border border-white/10 text-xs text-white font-medium"
                              >
                                <option value="listener">Listener</option>
                                <option value="artist">Artist</option>
                                <option value="label">Label</option>
                                <option value="distributor">Distributor</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-300">
                              <span>{u.playlists_count ?? 0} playlists</span>
                              <span className="mx-1.5 text-neutral-600">·</span>
                              <span>{u.likes_count ?? 0} likes</span>
                              <span className="mx-1.5 text-neutral-600">·</span>
                              <span>{u.comments_count ?? 0} comments</span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-medium ${
                                  (u.status || 'active') === 'active' ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {(u.status || 'active') === 'active' ? 'Active' : u.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleUpdateUser(u.id, { email_verified: !Number(u.email_verified) })}
                                className={`text-[11px] font-mono cursor-pointer ${
                                  Number(u.email_verified) ? 'text-emerald-400' : 'text-amber-400 underline'
                                }`}
                              >
                                {Number(u.email_verified) ? 'Verified' : 'Verify Now'}
                              </button>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400">
                              {u.last_login_at || u.created_at}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser({ ...u });
                                  setEditingUserPassword('');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setUserDetailTab('activity');
                                  setUserDetailActType('');
                                  setUserDetailDateFrom('');
                                  setUserDetailDateTo('');
                                  setUserDetailPage(1);
                                  handleOpenUserDetail(u.id, { action_type: '', date_from: '', date_to: '', page: 1 });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                              {(u.status || 'active') === 'active' ? (
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => handleUpdateUser(u.id, { status: 'suspended' })}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-medium cursor-pointer disabled:opacity-40"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateUser(u.id, { status: 'active' })}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-medium cursor-pointer"
                                >
                                  Restore
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isSelf}
                                onClick={() => setUserPendingDelete(u)}
                                title={isSelf ? 'Cannot delete your own active administrator account' : 'Delete User Account'}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-neutral-500">
                            No user accounts match your filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: MEDIA MATCHING */}
          {activeSection === 'media_scanner' && <MediaScannerAdmin />}

          {/* SECTION 3: ARTISTS & CLAIMS */}
          {activeSection === 'artists_claims' && (
            <div className="space-y-6">
              {/* Create Artist Form */}
              <form
                onSubmit={handleCreateArtist}
                className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-3"
              >
                <h3 className="text-sm font-bold text-white">Create Verified Artist Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <input
                    type="text"
                    required
                    value={newArtistName}
                    onChange={(e) => setNewArtistName(e.target.value)}
                    placeholder="Artist Name *"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    value={newArtistCountry}
                    onChange={(e) => setNewArtistCountry(e.target.value.toUpperCase())}
                    placeholder="Country (e.g. NG, US)"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white font-mono uppercase"
                  />
                  <input
                    type="text"
                    value={newArtistAvatar}
                    onChange={(e) => setNewArtistAvatar(e.target.value)}
                    placeholder="Display Picture URL (optional)"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold cursor-pointer"
                  >
                    Add Artist Profile
                  </button>
                </div>
              </form>

              <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Artist Profile Claims & Dispute Resolution ({dbClaims.length})
                </h3>
                <div className="space-y-3">
                  {dbClaims.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{c.artist_name || c.artist_id}</span>
                          <span className="text-neutral-400">·</span>
                          <span
                            className={`font-semibold uppercase text-[11px] ${
                              c.status === 'approved'
                                ? 'text-emerald-400'
                                : c.status === 'rejected'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }`}
                          >
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
                          className="mt-1 w-full max-w-md px-2.5 py-1.5 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReviewClaim(c.id, 'approved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                        >
                          Approve & Verify
                        </button>
                        <button
                          onClick={() => handleReviewClaim(c.id, 'disputed')}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
                        >
                          Mark Disputed
                        </button>
                        <button
                          onClick={() => handleReviewClaim(c.id, 'rejected')}
                          className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {dbClaims.length === 0 && (
                    <p className="text-xs text-neutral-500 py-4 text-center">No artist claims pending review.</p>
                  )}
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">Verified Artist Profiles ({dbArtists.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Artist</th>
                        <th className="py-3 px-4 font-medium">Label & Distributor</th>
                        <th className="py-3 px-4 font-medium">Claim Status</th>
                        <th className="py-3 px-4 font-medium text-center">Identity Verified</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {dbArtists.map((a) => (
                        <tr key={a.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 flex items-center gap-2.5">
                            <img
                              src={a.avatar_url}
                              alt={a.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover bg-neutral-800"
                            />
                            <span className="font-semibold text-white">{a.name}</span>
                          </td>
                          <td className="py-3 px-4 text-neutral-400">
                            {a.label_name || 'Independent'} · {a.distributor_name || 'Direct'}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={a.claimed_status || 'claimed'}
                              onChange={(e) => handleUpdateArtist(a.id, { claimed_status: e.target.value })}
                              className="px-2 py-1 rounded bg-[#141722] border border-white/10 text-xs text-white"
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
                              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                                Number(a.verified)
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/10 text-neutral-400'
                              }`}
                            >
                              {Number(a.verified) ? 'Verified' : 'Unverified'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteArtist(a.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Delete
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
              {editingTrack && (
                <div className="p-5 rounded-xl bg-[#0D0F16] border border-purple-500/40 space-y-4">
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
                      className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      value={editingTrack.artist_name}
                      onChange={(e) => setEditingTrack({ ...editingTrack, artist_name: e.target.value })}
                      placeholder="Artist"
                      className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      value={editingTrack.genre}
                      onChange={(e) => setEditingTrack({ ...editingTrack, genre: e.target.value })}
                      placeholder="Genre"
                      className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    />
                    <input
                      type="text"
                      value={editingTrack.cover_art_url}
                      onChange={(e) => setEditingTrack({ ...editingTrack, cover_art_url: e.target.value })}
                      placeholder="Artwork URL"
                      className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() =>
                        handleUpdateTrack(editingTrack.id, {
                          title: editingTrack.title,
                          artist_name: editingTrack.artist_name,
                          genre: editingTrack.genre,
                          cover_art_url: editingTrack.cover_art_url,
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-[#7E22CE] text-white font-semibold text-xs cursor-pointer"
                    >
                      Save Metadata & Artwork
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white">
                      Songs Library ({dbTracks.length || tracks.length})
                    </h3>
                    <button
                      onClick={() => setActiveSection('ytmusic_import')}
                      className="px-3 py-1.5 rounded-lg bg-[#7E22CE] text-white text-xs font-semibold hover:bg-[#6B21A8] cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload New Release</span>
                    </button>
                  </div>

                  {selectedCatalogTrackIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-purple-400 font-mono font-bold mr-1">
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
                        className="px-2.5 py-1 rounded bg-purple-600 text-white font-semibold cursor-pointer"
                      >
                        Re-Sync Audio
                      </button>
                      <button
                        onClick={() => handleBulkCatalogAction('delete')}
                        className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={dbTracks.length > 0 && selectedCatalogTrackIds.length === dbTracks.length}
                            onChange={(e) =>
                              setSelectedCatalogTrackIds(e.target.checked ? dbTracks.map((t) => t.id) : [])
                            }
                            className="accent-purple-500"
                          />
                        </th>
                        <th className="py-3 px-4 font-medium">Song & Artwork</th>
                        <th className="py-3 px-4 font-medium">Genre & Year</th>
                        <th className="py-3 px-4 font-medium">Audio & License</th>
                        <th className="py-3 px-4 font-medium text-right">Streams</th>
                        <th className="py-3 px-4 font-medium text-center">Featured</th>
                        <th className="py-3 px-4 font-medium text-center">Status</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
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
                                className="accent-purple-500"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={t.cover_art_url}
                                  alt={t.title}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-lg object-cover bg-neutral-800"
                                />
                                <div>
                                  <p className="font-semibold text-white">{t.title}</p>
                                  <p className="text-[11px] text-neutral-400">
                                    {t.artist_name} · {t.album_name}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-neutral-300">
                              <span>{t.genre}</span>
                              {t.release_year && (
                                <span className="text-[10px] font-mono text-neutral-500 block">
                                  {t.release_year} · {t.country || 'NG'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`text-[11px] font-mono ${
                                    t.has_local_audio || t.local_audio_path ? 'text-emerald-400' : 'text-amber-400'
                                  }`}
                                >
                                  {t.has_local_audio || t.local_audio_path
                                    ? `Hosted (${(t.audio_format || 'm4a').toUpperCase()})`
                                    : 'Pending Sync'}
                                </span>
                                <select
                                  value={t.license_status || 'verified_licensed'}
                                  onChange={(e) => handleUpdateTrack(t.id, { license_status: e.target.value })}
                                  className="px-1.5 py-0.5 rounded bg-[#141722] border border-white/10 text-[10px] text-neutral-300 w-fit"
                                >
                                  <option value="verified_licensed">Verified Licensed</option>
                                  <option value="direct_partner">Direct Partner</option>
                                  <option value="royalty_free">Royalty Free</option>
                                  <option value="pending_verification">Pending Verification</option>
                                </select>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                              {(Number(t.stream_count) || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() =>
                                  handleUpdateTrack(t.id, { featured_on_home: !Number(t.featured_on_home ?? 1) })
                                }
                                className={`p-1.5 rounded-lg cursor-pointer ${
                                  Number(t.featured_on_home ?? 1) ? 'text-amber-400' : 'text-neutral-500'
                                }`}
                              >
                                <Star className={`w-4 h-4 ${Number(t.featured_on_home ?? 1) ? 'fill-amber-400' : ''}`} />
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <select
                                value={t.status || 'active'}
                                onChange={(e) => handleUpdateTrack(t.id, { status: e.target.value })}
                                className="px-2 py-1 rounded bg-[#141722] border border-white/10 text-xs text-white"
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
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-neutral-200 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleUpdateTrack(t.id, { delete_permanently: true })}
                                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
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
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">Albums & Releases ({dbAlbums.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Album</th>
                        <th className="py-3 px-4 font-medium">Artist</th>
                        <th className="py-3 px-4 font-medium">Genre</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {dbAlbums.map((alb) => (
                        <tr key={alb.id}>
                          <td className="py-3 px-4 font-semibold text-white">{alb.title}</td>
                          <td className="py-3 px-4 text-neutral-300">{alb.artist_name}</td>
                          <td className="py-3 px-4 text-neutral-400">{alb.genre}</td>
                          <td className="py-3 px-4">
                            <select
                              value={alb.status || 'published'}
                              onChange={(e) => handleUpdateAlbum(alb.id, e.target.value)}
                              className="px-2 py-1 rounded bg-[#141722] border border-white/10 text-xs text-white"
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
                              className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-xs cursor-pointer"
                            >
                              Delete
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

          {/* SECTION: UPLOAD & STORAGE HUB */}
          {activeSection === 'ytmusic_import' && (
            <div className="space-y-6">
              {importProgressMsg && (
                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
                  <span className="font-semibold">{importProgressMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-1">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Server Audio Storage</span>
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums text-white">
                    {dbStorage?.audio_files_count ?? dbTracks.length} Audio Files
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-emerald-400">
                    {dbStorage?.audio_size_mb ?? '12.4'} MB hosted in /storage/audio
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-1">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Local Artwork Cache</span>
                    <Disc3 className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums text-white">
                    {dbStorage?.artwork_files_count ?? dbTracks.length} Artworks
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-blue-400">
                    {dbStorage?.artwork_size_mb ?? '3.8'} MB hosted in /storage/artwork
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-1">
                  <div className="flex items-center justify-between text-neutral-400 text-xs">
                    <span>Import Pipeline History</span>
                    <Activity className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums text-white">
                    {dbImportJobs.length} Import Jobs
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-purple-400">
                    {dbImportSchedules.length} Automated Sync Rules
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] flex flex-col justify-between gap-2">
                  <div className="text-xs text-neutral-300 font-semibold">Server Storage Integrity & Sync</div>
                  <button
                    onClick={handleSyncAllServerStorage}
                    disabled={isSyncingStorage}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingStorage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Verify & Sync All Local Audio</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleCreateDirectAdminRelease}
                  className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4"
                >
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Direct Master Release Upload
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Publish a new track with real audio, music video, synchronized LRC lyrics, and cover artwork directly to Flontmie server storage.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Track Title *</label>
                      <input
                        type="text"
                        required
                        value={newTrackTitle}
                        onChange={(e) => setNewTrackTitle(e.target.value)}
                        placeholder="e.g. Midnight Horizon"
                        className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Artist Name *</label>
                      <input
                        type="text"
                        required
                        value={newTrackArtist}
                        onChange={(e) => setNewTrackArtist(e.target.value)}
                        placeholder="e.g. Burna Boy"
                        className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Album / Release Title</label>
                      <input
                        type="text"
                        value={newTrackAlbum}
                        onChange={(e) => setNewTrackAlbum(e.target.value)}
                        placeholder="Single or Album Name"
                        className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Genre</label>
                      <input
                        type="text"
                        value={newTrackGenre}
                        onChange={(e) => setNewTrackGenre(e.target.value)}
                        placeholder="Afrobeats, Pop, Hip-Hop..."
                        className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Master Audio File (.mp3, .m4a, .wav, .flac)</label>
                      <input
                        type="file"
                        accept=".mp3,.m4a,.wav,.flac,.ogg,audio/*"
                        onChange={(e) => setNewTrackAudioFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-purple-500/20 file:text-purple-300 file:font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Music Video File (.mp4, .webm) [Optional]</label>
                      <input
                        type="file"
                        accept=".mp4,.webm,.mov,video/*"
                        onChange={(e) => setNewTrackVideoFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:text-blue-300 file:font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Cover Artwork (.jpg, .png, .webp) [Optional]</label>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,image/*"
                        onChange={(e) => setNewTrackArtworkFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:text-emerald-300 file:font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Timestamped Lyrics (.lrc, .srt, .txt) [Optional]</label>
                      <input
                        type="file"
                        accept=".lrc,.srt,.vtt,.txt"
                        onChange={(e) => setNewTrackLyricsFile(e.target.files?.[0] || null)}
                        className="w-full text-[11px] text-neutral-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-300 file:font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">
                      Or Paste LRC / Plain Lyrics Directly (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={newTrackLyrics}
                      onChange={(e) => setNewTrackLyrics(e.target.value)}
                      placeholder="[00:12.50] First line of synchronized lyrics..."
                      className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingDirectTrack}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingDirectTrack ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading Release to Server...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload & Publish Direct Release</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Authorized Master Audio & Artwork File Upload
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Upload authorized audio files (.mp3, .m4a, .wav, .flac) or artwork (.jpg, .png, .webp) directly into protected server storage and sync with existing releases.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-neutral-400 mb-1">Sync With Existing Track (Optional)</label>
                        <select
                          value={uploadTargetTrackId}
                          onChange={(e) => setUploadTargetTrackId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
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
                          className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                        >
                          <option value="audio">Master Audio File (.mp3, .m4a, .wav, .flac)</option>
                          <option value="artwork">Cover Artwork Image (.jpg, .png, .webp)</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/15 hover:border-purple-500/50 rounded-xl bg-[#141722]/60 cursor-pointer transition-colors">
                      {isUploadingFile ? (
                        <div className="flex items-center gap-2 text-purple-400 font-semibold">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Uploading & validating file into Flontmie server storage...</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-purple-400 mb-2" />
                          <span className="font-bold text-white">
                            Click to select authorized {uploadMediaType} file
                          </span>
                          <span className="text-[11px] text-neutral-500 mt-1">
                            Stored in protected server directories and streamed via /phpbackend/api/stream.php
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept={
                          uploadMediaType === 'audio'
                            ? '.mp3,.m4a,.wav,.flac,.ogg,audio/*'
                            : '.jpg,.jpeg,.png,.webp,image/*'
                        }
                        onChange={handleAuthorizedMediaUpload}
                        disabled={isUploadingFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: DISTRIBUTORS & LABELS */}
          {activeSection === 'distributors_labels' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                  <h3 className="text-sm font-bold text-white">
                    Partner Distributors ({dbDistributors.length})
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {dbDistributors.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-white">{d.name}</p>
                          <p className="text-[11px] text-neutral-400">
                            {d.contact_email} · {d.access_level || d.quota_type || 'full_ingestion'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={d.status || 'active'}
                            onChange={async (e) => {
                              await api.updateAdminDistributor({ id: d.id, status: e.target.value });
                              fetchAdminData();
                            }}
                            className="px-2 py-1 rounded bg-[#141722] border border-white/10 text-xs text-white"
                          >
                            <option value="active">Active</option>
                            <option value="approved">Approved</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                          </select>
                          <button
                            onClick={async () => {
                              await api.deleteAdminDistributor(d.id);
                              fetchAdminData();
                            }}
                            className="p-1.5 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleCreateDistributor} className="pt-2 flex gap-2">
                    <input
                      type="text"
                      value={newDistName}
                      onChange={(e) => setNewDistName(e.target.value)}
                      placeholder="New Distributor Name"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                    />
                    <input
                      type="email"
                      value={newDistEmail}
                      onChange={(e) => setNewDistEmail(e.target.value)}
                      placeholder="Contact Email"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#7E22CE] text-white text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                </div>

                <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                  <h3 className="text-sm font-bold text-white">
                    Registered Record Labels ({dbLabels.length})
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {dbLabels.map((l) => (
                      <div
                        key={l.id}
                        className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-white">{l.name}</p>
                          <p className="text-[11px] text-neutral-400">
                            {l.contact_email} · {l.country}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={l.status || 'active'}
                            onChange={async (e) => {
                              await api.updateAdminLabel({ id: l.id, status: e.target.value, country: l.country });
                              fetchAdminData();
                            }}
                            className="px-2 py-1 rounded bg-[#141722] border border-white/10 text-xs text-white"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                          </select>
                          <button
                            onClick={async () => {
                              await api.deleteAdminLabel(l.id);
                              fetchAdminData();
                            }}
                            className="p-1.5 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleCreateLabel} className="pt-2 flex gap-2">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="New Label Name"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                    />
                    <input
                      type="email"
                      value={newLabelEmail}
                      onChange={(e) => setNewLabelEmail(e.target.value)}
                      placeholder="Contact Email"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#7E22CE] text-white text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: MODERATION */}
          {activeSection === 'moderation' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Copyright, Impersonation & Content Moderation Queue ({dbReports.length})
                </h3>
                <div className="space-y-3">
                  {dbReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-bold uppercase text-[11px]">{rep.category}</span>
                          <span>·</span>
                          <span className="font-bold text-white">{rep.target_name}</span>
                          <span className="text-neutral-400 font-mono">
                            ({rep.target_type}: {rep.target_id})
                          </span>
                          <span>·</span>
                          <span className="text-neutral-300 uppercase text-[11px]">{rep.status}</span>
                        </div>
                        <p className="text-neutral-300">{rep.reason}</p>
                        <p className="text-[11px] text-neutral-500">
                          Reporter: {rep.reporter_email} · {rep.created_at}
                        </p>
                        <input
                          type="text"
                          value={repNotesMap[rep.id] ?? rep.resolution_notes ?? ''}
                          onChange={(e) => setRepNotesMap({ ...repNotesMap, [rep.id]: e.target.value })}
                          placeholder="Resolution notes..."
                          className="mt-1 w-full max-w-md px-2.5 py-1 rounded bg-[#141722] border border-white/10 text-white"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleResolveReport(rep.id, 'resolved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'resolved', 'unpublish_track')}
                          className="px-3 py-1.5 rounded-lg bg-red-600/25 border border-red-500/40 text-red-300 font-semibold cursor-pointer"
                        >
                          Flag Target Content
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismissed')}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-neutral-300 font-semibold cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                  {dbReports.length === 0 && (
                    <p className="text-xs text-neutral-500 py-4 text-center">No open moderation cases.</p>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleCreateReport}
                className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-3"
              >
                <h4 className="text-xs font-bold text-white">Log New Moderation / Copyright Case</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select
                    value={repCategory}
                    onChange={(e) => setRepCategory(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
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
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
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
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    required
                    value={repReason}
                    onChange={(e) => setRepReason(e.target.value)}
                    placeholder="Detailed complaint or reason..."
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#7E22CE] text-white font-semibold text-xs cursor-pointer"
                >
                  Submit Moderation Case
                </button>
              </form>
            </div>
          )}

          {/* SECTION 7: ANALYTICS */}
          {activeSection === 'analytics' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-white">Most Streamed Songs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {(dbAnalytics?.top_tracks || dbTracks.slice(0, 10)).map((t: any, i: number) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono tabular-nums font-bold text-neutral-400 w-5">#{i + 1}</span>
                        <img src={t.cover_art_url} alt={t.title} className="w-9 h-9 rounded-lg object-cover" />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{t.title}</p>
                          <p className="text-neutral-400 truncate">{t.artist_name}</p>
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-emerald-400">
                        {(Number(t.stream_count) || 0).toLocaleString()} plays
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 8: PLAYLISTS & GENRES */}
          {activeSection === 'playlists_genres' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08]">
                  <p className="text-xs text-neutral-400">Total Playlists</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                    {playlistSummary?.total_playlists ?? stats?.total_playlists ?? dbPlaylists.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08]">
                  <p className="text-xs text-neutral-400">Admin-Created</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-purple-400 mt-1">
                    {playlistSummary?.admin_playlists_count ?? stats?.admin_playlists_count ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08]">
                  <p className="text-xs text-neutral-400">User-Created</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-blue-400 mt-1">
                    {playlistSummary?.user_playlists_count ?? stats?.user_playlists_count ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08]">
                  <p className="text-xs text-neutral-400">Public vs Private</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    {playlistSummary?.public_playlists_count ?? 0} Public · {playlistSummary?.private_playlists_count ?? 0} Private
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={playlistSearch}
                    onChange={(e) => {
                      setPlaylistSearch(e.target.value);
                      setPlaylistPage(1);
                    }}
                    placeholder="Search playlists by title, description, creator name, username, or email..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={playlistCreatorType}
                    onChange={(e) => {
                      setPlaylistCreatorType(e.target.value as 'all' | 'admin' | 'user');
                      setPlaylistPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                  >
                    <option value="all">All Creators (Admin & User)</option>
                    <option value="admin">Admin-Created Only</option>
                    <option value="user">User-Created Only</option>
                  </select>

                  <select
                    value={playlistVisibility}
                    onChange={(e) => {
                      setPlaylistVisibility(e.target.value as 'all' | 'public' | 'private');
                      setPlaylistPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                  >
                    <option value="all">All Visibility</option>
                    <option value="public">Public Only</option>
                    <option value="private">Private Only</option>
                  </select>
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">
                    All Platform Playlists ({playlistTotal || dbPlaylists.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Playlist</th>
                        <th className="py-3 px-4 font-medium">Creator Account</th>
                        <th className="py-3 px-4 font-medium">Visibility</th>
                        <th className="py-3 px-4 font-medium">Tracks</th>
                        <th className="py-3 px-4 font-medium">Created</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {(adminPlaylists.length > 0 ? adminPlaylists : dbPlaylists).map((pl) => {
                        const isAdminCreated = Boolean(pl.is_admin_created);
                        const trackCount = pl.track_count ?? (pl.track_ids || []).length;
                        return (
                          <tr key={pl.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={pl.cover_art_url || '/assets/albums/default_album.jpg'}
                                  alt={pl.title}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 bg-neutral-800"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate">{pl.title}</div>
                                  <div className="text-[11px] text-neutral-400 truncate max-w-xs">
                                    {pl.description || `Category: ${pl.genre_category || 'all'}`}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {pl.creator_name || pl.curator_name || 'Flontmie Editorial'}
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                {isAdminCreated ? 'Admin' : 'User'} · {pl.creator_email || 'Editorial'}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-neutral-300">
                                {Number(pl.is_public ?? 1) === 1 ? 'Public' : 'Private'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-white">{trackCount} songs</td>
                            <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400">
                              {pl.created_at || '—'}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => handleOpenPlaylistDetail(pl.id)}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-medium text-[11px] cursor-pointer"
                              >
                                Inspect Songs
                              </button>
                              <button
                                onClick={() => handleUpdatePlaylist(pl.id, { delete: true })}
                                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-semibold text-[11px] cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Genres Management */}
              <div className="p-5 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-white">Platform Genres ({dbGenres.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {dbGenres.map((g) => (
                    <div
                      key={g.id}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs flex items-center gap-2"
                    >
                      <span className="font-semibold text-white">{g.name}</span>
                      <button
                        onClick={async () => {
                          await api.deleteAdminGenre(g.id);
                          fetchAdminData();
                        }}
                        className="text-neutral-500 hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSaveGenre} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
                  <input
                    type="text"
                    required
                    value={newGenreName}
                    onChange={(e) => setNewGenreName(e.target.value)}
                    placeholder="New Genre Name (e.g. Amapiano)"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                  <input
                    type="text"
                    value={newGenreDesc}
                    onChange={(e) => setNewGenreDesc(e.target.value)}
                    placeholder="Description"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    value={newGenreOrder}
                    onChange={(e) => setNewGenreOrder(Number(e.target.value))}
                    placeholder="Sort Order"
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#7E22CE] text-white font-semibold cursor-pointer"
                  >
                    Add Genre
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* SECTION: USER ACTIVITY */}
          {activeSection === 'user_activity' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="relative">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={activitySearch}
                      onChange={(e) => {
                        setActivitySearch(e.target.value);
                        setActivitiesPage(1);
                      }}
                      placeholder="Search user, song, playlist, or action..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                    />
                  </div>

                  <select
                    value={activityUserFilter}
                    onChange={(e) => {
                      setActivityUserFilter(e.target.value);
                      setActivitiesPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="">All Users</option>
                    {dbUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name || u.username} ({u.email})
                      </option>
                    ))}
                  </select>

                  <select
                    value={activityTypeFilter}
                    onChange={(e) => {
                      setActivityTypeFilter(e.target.value);
                      setActivitiesPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="">All Activity Types</option>
                    {availableActionTypes.map((at) => (
                      <option key={at} value={at}>
                        {at}
                      </option>
                    ))}
                  </select>

                  <select
                    value={activityTargetTypeFilter}
                    onChange={(e) => {
                      setActivityTargetTypeFilter(e.target.value);
                      setActivitiesPage(1);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="">All Target Objects</option>
                    <option value="playlist">Playlist</option>
                    <option value="track">Track</option>
                    <option value="artist">Artist</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">
                    Platform User Creations & Activity History ({activitiesTotal})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Timestamp</th>
                        <th className="py-3 px-4 font-medium">User Account</th>
                        <th className="py-3 px-4 font-medium">Activity Type</th>
                        <th className="py-3 px-4 font-medium">Target Object</th>
                        <th className="py-3 px-4 font-medium text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {adminActivities.map((act) => (
                        <tr key={act.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400 whitespace-nowrap">
                            {act.created_at}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{act.display_name || act.user_name || 'User'}</div>
                            <div className="text-[11px] font-mono text-neutral-400">
                              {act.email || act.user_email || act.user_id}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-purple-300">{act.action_type}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{act.target_title || act.target_id || '—'}</div>
                            <div className="text-[10px] font-mono uppercase text-neutral-400">
                              {act.target_type} {act.target_id ? `· ${act.target_id}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {act.target_type === 'playlist' && act.target_id && (
                              <button
                                onClick={() => handleOpenPlaylistDetail(act.target_id)}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-white font-medium text-[11px] cursor-pointer"
                              >
                                Playlist
                              </button>
                            )}
                            {act.user_id && (
                              <button
                                onClick={() => handleOpenUserDetail(act.user_id, { page: 1 })}
                                className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-white font-medium text-[11px] cursor-pointer"
                              >
                                User Profile
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

          {/* SECTION: ENGAGEMENT (LIKES & COMMENTS) */}
          {activeSection === 'engagement' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0D0F16] border border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'tracks', label: 'Per-Track Totals' },
                    { id: 'likes', label: `All Likes (${engagementData?.likes?.total ?? stats?.total_likes ?? 0})` },
                    { id: 'comments', label: `All Comments (${engagementData?.comments?.total ?? stats?.total_comments ?? 0})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setEngagementTab(t.id as any);
                        setEngagementPage(1);
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                        engagementTab === t.id
                          ? 'bg-white text-black'
                          : 'bg-[#141722] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={engagementSearch}
                    onChange={(e) => {
                      setEngagementSearch(e.target.value);
                      setEngagementPage(1);
                    }}
                    placeholder="Search by song title, artist, user, or comment text..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-xs text-white"
                  />
                </div>
              </div>

              {engagementTab === 'tracks' && (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Track</th>
                          <th className="py-3 px-4 font-medium">Artist</th>
                          <th className="py-3 px-4 font-medium">Likes</th>
                          <th className="py-3 px-4 font-medium">Comments</th>
                          <th className="py-3 px-4 font-medium">Streams</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {(engagementData?.tracks_engagement || dbTracks).map((t: any) => (
                          <tr key={t.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4 font-semibold text-white">{t.title}</td>
                            <td className="py-3 px-4 text-neutral-300">{t.artist_name}</td>
                            <td className="py-3 px-4 font-mono tabular-nums text-rose-400">
                              {Number(t.likes_count) || 0}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-blue-400">
                              {Number(t.comments_count) || 0}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-emerald-400">
                              {(Number(t.flontmie_plays ?? t.stream_count) || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {engagementTab === 'likes' && (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Liked At</th>
                          <th className="py-3 px-4 font-medium">User</th>
                          <th className="py-3 px-4 font-medium">Track</th>
                          <th className="py-3 px-4 font-medium text-right">Inspect User</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {(engagementData?.likes?.items || []).map((lk: any, idx: number) => (
                          <tr key={`${lk.user_id}_${lk.track_id}_${idx}`} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400">
                              {lk.created_at}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {lk.display_name || lk.username || lk.user_id}
                              </div>
                              <div className="text-[11px] font-mono text-neutral-400">{lk.email}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{lk.track_title || lk.track_id}</div>
                              <div className="text-[11px] text-neutral-400">{lk.artist_name}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {lk.user_id && (
                                <button
                                  onClick={() => handleOpenUserDetail(lk.user_id, { page: 1 })}
                                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-white text-[11px] font-medium cursor-pointer"
                                >
                                  View User
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {engagementTab === 'comments' && (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-3 px-4 font-medium">Posted At</th>
                          <th className="py-3 px-4 font-medium">Author</th>
                          <th className="py-3 px-4 font-medium">Track</th>
                          <th className="py-3 px-4 font-medium">Comment Text</th>
                          <th className="py-3 px-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {(engagementData?.comments?.items || []).map((cm: any) => (
                          <tr key={cm.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400 whitespace-nowrap">
                              {cm.created_at}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{cm.display_name || cm.user_name}</div>
                              <div className="text-[11px] font-mono text-neutral-400">{cm.email || cm.user_id}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{cm.track_title || cm.track_id}</div>
                              <div className="text-[11px] text-neutral-400">{cm.artist_name}</div>
                            </td>
                            <td className="py-3 px-4 text-neutral-200 max-w-md">{cm.comment_text}</td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteAdminComment(cm.id)}
                                className="px-2.5 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 9: SYSTEM SETTINGS */}
          {activeSection === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="p-6 rounded-xl bg-[#0D0F16] border border-white/[0.08] space-y-5 max-w-3xl"
            >
              <div>
                <h3 className="text-base font-bold text-white">Platform Configuration & System Rules</h3>
                <p className="text-xs text-neutral-400">
                  All settings are persisted in MySQL storage and enforced on the backend.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">Platform Display Name</label>
                  <input
                    type="text"
                    value={dbSettings.platform_name ?? 'Flontmie Music Streaming & Industry Hub'}
                    onChange={(e) => setDbSettings({ ...dbSettings, platform_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#141722] border border-white/10 text-white"
                  />
                </div>

                {[
                  { key: 'maintenance_mode', label: 'Maintenance Mode (Restrict access to Administrators only)' },
                  { key: 'allow_public_registration', label: 'Allow Public Account Registration' },
                  { key: 'require_email_verification', label: 'Require Email Verification for New Accounts' },
                  { key: 'allow_artist_claims', label: 'Allow Artist Profile Verification Claims' },
                  { key: 'offline_downloads_enabled', label: 'Enable Native & Offline Track Downloads' },
                  { key: 'social_jam_sessions_enabled', label: 'Enable Live Social Jam Listening Rooms' },
                  { key: 'direct_distributor_ingestion', label: 'Allow Partner Distributor Direct Ingestion' },
                ].map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] cursor-pointer"
                  >
                    <span className="font-medium text-neutral-200">{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={(dbSettings[toggle.key] ?? 'false') === 'true'}
                      onChange={(e) =>
                        setDbSettings({ ...dbSettings, [toggle.key]: e.target.checked ? 'true' : 'false' })
                      }
                      className="accent-purple-500 w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold text-xs cursor-pointer"
              >
                Save System Configuration
              </button>
            </form>
          )}

          {/* SECTION 10: AUDIT LOGS */}
          {activeSection === 'audit_logs' && (
            <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
              <div className="p-4 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-white">
                  Immutable Administrator & Platform Audit Trail ({dbAuditLogs.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                    <tr>
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">Actor</th>
                      <th className="py-3 px-4 font-medium">Action</th>
                      <th className="py-3 px-4 font-medium">Entity</th>
                      <th className="py-3 px-4 font-medium">Details</th>
                      <th className="py-3 px-4 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {dbAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-[11px] text-neutral-400 whitespace-nowrap">
                          {log.created_at}
                        </td>
                        <td className="py-2.5 px-4 text-white">
                          {log.actor_email || log.user_email || log.user_id || 'System'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-purple-300">{log.action}</td>
                        <td className="py-2.5 px-4 text-neutral-300">
                          {log.entity_type} · {log.entity_id}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-neutral-400 max-w-xs truncate">
                          {log.details_json}
                        </td>
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
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0D0F16]">
                <div className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-sm font-bold text-white">
                    Server-Side Active Sessions ({dbSessions.length})
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Manage authenticated sessions and revoke suspicious tokens immediately.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.02] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-3 px-4 font-medium">Session ID</th>
                        <th className="py-3 px-4 font-medium">User</th>
                        <th className="py-3 px-4 font-medium">IP & Agent</th>
                        <th className="py-3 px-4 font-medium">Last Active</th>
                        <th className="py-3 px-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {dbSessions.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 px-4 font-mono text-[11px] text-neutral-300">{s.id}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">{s.email || s.user_id}</span>
                            <span className="ml-2 text-[11px] text-neutral-400">({s.role})</span>
                          </td>
                          <td className="py-3 px-4 text-[11px] text-neutral-400 max-w-xs truncate">
                            {s.ip_address} · {s.user_agent}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-neutral-400">
                            {s.last_active_at}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!Number(s.is_revoked) && (
                              <button
                                onClick={async () => {
                                  await api.revokeAdminSession({ session_id: s.id });
                                  showNotice(`Session ${s.id} revoked.`);
                                  fetchAdminData();
                                }}
                                className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-semibold cursor-pointer"
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
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CREATE NEW USER ACCOUNT (Global Trigger from Anywhere in Admin) */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F16] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  <span>Create New User Account</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Create a verified user in the MySQL database and assign their platform role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Tems or Universal Music Nigeria"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-neutral-300 font-medium">Initial Password (min 6 characters) *</label>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-[11px] text-purple-400 hover:underline cursor-pointer"
                  >
                    Generate Strong Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Platform Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="listener">Listener</option>
                    <option value="artist">Artist</option>
                    <option value="label">Record Label</option>
                    <option value="distributor">Distributor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Country Code</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newUserCountry}
                    onChange={(e) => setNewUserCountry(e.target.value.toUpperCase())}
                    placeholder="NG"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER ACCOUNT */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F16] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Edit User Account</h3>
                <p className="text-xs text-neutral-400 font-mono mt-0.5">{editingUser.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.display_name || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, display_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Role</label>
                  <select
                    value={editingUser.role || 'listener'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="listener">Listener</option>
                    <option value="artist">Artist</option>
                    <option value="label">Record Label</option>
                    <option value="distributor">Distributor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">Account Status</label>
                  <select
                    value={editingUser.status || 'active'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  Reset Password (leave blank to keep current password)
                </label>
                <input
                  type="text"
                  value={editingUserPassword}
                  onChange={(e) => setEditingUserPassword(e.target.value)}
                  placeholder="New password (min 6 characters)"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#141722] border border-white/10 text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const u = editingUser;
                    setEditingUser(null);
                    setUserPendingDelete(u);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete User</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-200 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUserEdit}
                    className="px-5 py-2 rounded-lg bg-[#7E22CE] hover:bg-[#6B21A8] text-white font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingUserEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM PERMANENT USER DELETION */}
      {userPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F16] border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete User Account</h3>
                  <p className="text-xs text-neutral-400">This action is permanent and cannot be undone.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserPendingDelete(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs space-y-1">
              <div className="font-bold text-white text-sm">
                {userPendingDelete.display_name || userPendingDelete.username}
              </div>
              <div className="font-mono text-neutral-300">{userPendingDelete.email}</div>
              <div className="text-neutral-400">
                Role: <span className="uppercase text-white font-semibold">{userPendingDelete.role}</span> · ID:{' '}
                <span className="font-mono">{userPendingDelete.id}</span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Deleting this user will revoke all active sessions, remove their account from the MySQL database, and reconcile track engagement counts.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserPendingDelete(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-neutral-200 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Permanent Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: PLAYLIST CONTENTS & ORDERED SONGS INSPECTOR */}
      {(selectedPlaylistDetail || loadingPlaylistDetail) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F16] border border-white/15 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
              {loadingPlaylistDetail ? (
                <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading ordered playlist tracks...</span>
                </div>
              ) : (
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={selectedPlaylistDetail?.playlist?.cover_art_url || '/assets/albums/default_album.jpg'}
                    alt={selectedPlaylistDetail?.playlist?.title}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">
                      {selectedPlaylistDetail?.playlist?.title}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Creator:{' '}
                      <strong className="text-white">
                        {selectedPlaylistDetail?.playlist?.creator?.display_name || 'Flontmie Editorial'}
                      </strong>{' '}
                      · {selectedPlaylistDetail?.playlist?.track_count ?? (selectedPlaylistDetail?.tracks || []).length} songs
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedPlaylistDetail(null)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!loadingPlaylistDetail && selectedPlaylistDetail && (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-white/[0.03] text-neutral-400 border-b border-white/[0.06]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 font-medium">#</th>
                        <th className="py-2.5 px-3 font-medium">Song Title</th>
                        <th className="py-2.5 px-3 font-medium">Artist & Album</th>
                        <th className="py-2.5 px-3 font-medium">Duration</th>
                        <th className="py-2.5 px-3 font-medium">Likes / Comments</th>
                        <th className="py-2.5 px-3 font-medium">Streams</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {(selectedPlaylistDetail.tracks || []).map((tr: any, idx: number) => (
                        <tr key={`${tr.id}_${idx}`} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-neutral-400">
                            #{tr.position ?? idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">{tr.title}</td>
                          <td className="py-2.5 px-3 text-neutral-300">
                            {tr.artist_name} · {tr.album_title}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-400">{tr.duration || '—'}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            <span className="text-rose-400">{tr.likes_count ?? 0} likes</span>
                            {' · '}
                            <span className="text-blue-400">{tr.comments_count ?? 0} comments</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-emerald-400">
                            {(Number(tr.stream_count) || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: USER PROFILE CREATIONS & ACTIVITY HISTORY INSPECTOR (Includes Delete User Button) */}
      {(selectedUserDetail || loadingUserDetail) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D0F16] border border-white/15 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
              {loadingUserDetail ? (
                <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading user profile, creations & activity history...</span>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedUserDetail?.user?.display_name} (@{selectedUserDetail?.user?.username})
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    {selectedUserDetail?.user?.email} · Role: {selectedUserDetail?.user?.role} · Joined:{' '}
                    {selectedUserDetail?.user?.created_at}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {!loadingUserDetail && selectedUserDetail?.user && (
                  <button
                    type="button"
                    onClick={() => setUserPendingDelete(selectedUserDetail.user)}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedUserDetail(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!loadingUserDetail && selectedUserDetail && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'activity', label: `Activity History (${selectedUserDetail?.summary?.activities_count ?? 0})` },
                    { id: 'playlists', label: `Created Playlists (${selectedUserDetail?.summary?.playlists_count ?? 0})` },
                    { id: 'likes', label: `Liked Songs (${selectedUserDetail?.summary?.likes_count ?? 0})` },
                    { id: 'comments', label: `Comments (${selectedUserDetail?.summary?.comments_count ?? 0})` },
                    { id: 'follows', label: `Followed Artists (${selectedUserDetail?.summary?.followed_artists_count ?? 0})` },
                    { id: 'uploads', label: `Uploaded Releases (${selectedUserDetail?.summary?.uploaded_tracks_count ?? 0})` },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      onClick={() => setUserDetailTab(tb.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        userDetailTab === tb.id
                          ? 'bg-white text-black'
                          : 'bg-white/[0.06] text-neutral-300 hover:text-white'
                      }`}
                    >
                      {tb.label}
                    </button>
                  ))}
                </div>

                {userDetailTab === 'activity' && (
                  <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/[0.03] text-neutral-400 border-b border-white/[0.06]">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Timestamp</th>
                          <th className="py-2.5 px-3 font-medium">Action</th>
                          <th className="py-2.5 px-3 font-medium">Target</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {(selectedUserDetail?.activities?.items || []).map((act: any) => (
                          <tr key={act.id}>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-neutral-400">
                              {act.created_at}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-purple-300">{act.action_type}</td>
                            <td className="py-2.5 px-3 text-white">
                              {act.target_title || act.target_id} ({act.target_type})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {userDetailTab === 'playlists' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {(selectedUserDetail?.creations?.playlists || []).map((pl: any) => (
                      <div
                        key={pl.id}
                        className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-white">{pl.title}</div>
                          <div className="text-[11px] text-neutral-400">
                            {pl.track_count} songs · {Number(pl.is_public ?? 1) === 1 ? 'Public' : 'Private'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenPlaylistDetail(pl.id)}
                          className="px-3 py-1.5 rounded-lg bg-white text-black font-semibold text-[11px] cursor-pointer"
                        >
                          View Songs
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {userDetailTab === 'likes' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {(selectedUserDetail?.creations?.liked_tracks || []).map((lt: any) => (
                      <div
                        key={lt.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">{lt.title}</div>
                          <div className="text-[11px] text-neutral-400">{lt.artist_name}</div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-neutral-400">{lt.liked_at}</span>
                      </div>
                    ))}
                  </div>
                )}

                {userDetailTab === 'comments' && (
                  <div className="space-y-2 text-xs">
                    {(selectedUserDetail?.creations?.comments || []).map((cm: any) => (
                      <div
                        key={cm.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            On: {cm.track_title || cm.track_id} —{' '}
                            <span className="text-neutral-400">{cm.created_at}</span>
                          </div>
                          <div className="text-neutral-200 mt-1">{cm.comment_text}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteAdminComment(cm.id)}
                          className="px-2.5 py-1 rounded bg-red-600/20 text-red-300 text-[11px] font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {userDetailTab === 'follows' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {(selectedUserDetail?.creations?.followed_artists || []).map((fa: any) => (
                      <div
                        key={fa.artist_id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between"
                      >
                        <span className="font-semibold text-white">{fa.artist_name || fa.artist_id}</span>
                        <span className="font-mono tabular-nums text-[11px] text-neutral-400">{fa.created_at}</span>
                      </div>
                    ))}
                  </div>
                )}

                {userDetailTab === 'uploads' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {(selectedUserDetail?.creations?.uploaded_tracks || []).map((ut: any) => (
                      <div
                        key={ut.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white">{ut.title}</div>
                          <div className="text-[11px] text-neutral-400">
                            {ut.artist_name} · {ut.genre}
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-emerald-400">
                          {ut.likes_count ?? 0} likes · {ut.comments_count ?? 0} comments
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
