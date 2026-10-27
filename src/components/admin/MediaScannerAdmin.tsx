import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FolderSearch, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  AlertTriangle, 
  Video, 
  Play, 
  Pause, 
  RotateCw, 
  Search, 
  Link as LinkIcon, 
  Unlink, 
  Check, 
  X, 
  Loader2, 
  Music, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileAudio,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../../services/api';

export const MediaScannerAdmin: React.FC = () => {
  const [counts, setCounts] = useState<{
    total_scanned: number;
    matched: number;
    ambiguous: number;
    unmatched: number;
    unsupported: number;
    error: number;
    video_files: number;
  }>({
    total_scanned: 0,
    matched: 0,
    ambiguous: 0,
    unmatched: 0,
    unsupported: 0,
    error: 0,
    video_files: 0
  });

  const [activeRun, setActiveRun] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [files, setFiles] = useState<any[]>([]);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scanDirectories, setScanDirectories] = useState<string[]>([]);

  // Scanning loop states
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{
    percent: number;
    offset: number;
    total: number;
    currentBatch: number;
  }>({ percent: 0, offset: 0, total: 0, currentBatch: 0 });
  const stopScanRef = useRef<boolean>(false);

  // Audio preview player state
  const [previewingFileId, setPreviewingFileId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Manual link modal
  const [linkModalFile, setLinkModalFile] = useState<any | null>(null);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Load Status and Overview
  const loadStatus = useCallback(async () => {
    try {
      const res = await api.getMediaScannerStatus();
      if (res && res.status === 'success') {
        setCounts(res.counts);
        setActiveRun(res.run);
        setScanDirectories(res.scan_directories || []);
        if (res.run && res.run.status === 'running') {
          const tot = res.run.total_files_found || 1;
          const off = res.run.current_offset || 0;
          setScanProgress({
            percent: Math.min(100, Math.round((off / tot) * 100)),
            offset: off,
            total: tot,
            currentBatch: 0
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load media scanner status:', err);
    }
  }, []);

  // Load Files
  const loadFiles = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const res = await api.getMediaScannerFiles({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        media_type: mediaFilter !== 'all' ? mediaFilter : undefined,
        q: searchQuery.trim() || undefined,
        page,
        limit: 25
      });
      if (res && res.status === 'success') {
        setFiles(res.files || []);
        setTotalFiles(res.total || 0);
        setCurrentPage(res.page || 1);
        setTotalPages(res.total_pages || 1);
      }
    } catch (err: any) {
      console.error('Failed to load files:', err);
      showNotification('error', 'Failed to load media files list');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mediaFilter, searchQuery]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadFiles(1);
  }, [loadFiles]);

  // Audio preview teardown
  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.src = '';
      }
    };
  }, [previewAudio]);

  const togglePreview = (file: any) => {
    if (previewingFileId === file.id) {
      if (previewAudio) {
        previewAudio.pause();
      }
      setPreviewingFileId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    const token = api.getToken();
    const audioUrl = `https://flontmie.ticketplaster.com/phpbackend/api/stream.php?scan_file_id=${encodeURIComponent(file.id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

    const newAudio = new Audio(audioUrl);
    newAudio.crossOrigin = 'anonymous';
    newAudio.play().then(() => {
      setPreviewAudio(newAudio);
      setPreviewingFileId(file.id);
    }).catch(err => {
      console.error('Preview playback failed:', err);
      showNotification('error', 'Playback stream failed or format not playable in browser');
    });

    newAudio.onended = () => {
      setPreviewingFileId(null);
    };
  };

  // Scanning batch loop
  const runScanLoop = async (isNew: boolean) => {
    setIsScanning(true);
    stopScanRef.current = false;

    try {
      // Step 1: initiate or resume
      let res = isNew ? await api.startMediaScanNow(25) : await api.resumeMediaScan(25);
      if (!res || res.status !== 'success' || !res.batch) {
        showNotification('error', 'Failed to start media scanner batch');
        setIsScanning(false);
        return;
      }

      let batch = res.batch;
      setCounts(batch.counts);
      setScanProgress({
        percent: batch.percent,
        offset: batch.offset,
        total: batch.total_files,
        currentBatch: 1
      });

      let currentBatchNum = 1;

      // Step 2: continue chaining batches until complete or user paused
      while (!batch.is_complete && !stopScanRef.current) {
        currentBatchNum++;
        const nextBatchRes = await api.runMediaScanBatch(25);
        if (!nextBatchRes || nextBatchRes.status !== 'success' || !nextBatchRes.batch) {
          break;
        }
        batch = nextBatchRes.batch;
        setCounts(batch.counts);
        setScanProgress({
          percent: batch.percent,
          offset: batch.offset,
          total: batch.total_files,
          currentBatch: currentBatchNum
        });
      }

      if (batch.is_complete) {
        showNotification('success', `Media scan completed! Scanned ${batch.total_files} files with ${batch.counts.matched} matches.`);
      } else {
        showNotification('success', 'Media scanning paused.');
      }
    } catch (err: any) {
      console.error('Scanning error:', err);
      showNotification('error', err.message || 'Media scanning error encountered');
    } finally {
      setIsScanning(false);
      loadStatus();
      loadFiles(currentPage);
    }
  };

  const handleStopScan = () => {
    stopScanRef.current = true;
    setIsScanning(false);
  };

  // Manual link action
  const handleManualLink = async (fileId: string, trackId: string) => {
    setActionLoading(fileId);
    try {
      const res = await api.manualLinkMediaFile(fileId, trackId);
      if (res && res.status === 'success') {
        showNotification('success', res.message || 'File linked to track');
        setLinkModalFile(null);
        setCatalogResults([]);
        setCatalogSearch('');
        loadStatus();
        loadFiles(currentPage);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to link file');
    } finally {
      setActionLoading(null);
    }
  };

  // Unlink action
  const handleUnlink = async (fileId: string) => {
    setActionLoading(fileId);
    try {
      const res = await api.unlinkMediaFile(fileId);
      if (res && res.status === 'success') {
        showNotification('success', res.message || 'File unlinked');
        loadStatus();
        loadFiles(currentPage);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to unlink file');
    } finally {
      setActionLoading(null);
    }
  };

  // Catalog search debounce
  useEffect(() => {
    if (!catalogSearch.trim()) {
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCatalog(true);
      try {
        const res = await api.searchCatalogForMediaMatch(catalogSearch);
        if (res && res.status === 'success') {
          setCatalogResults(res.tracks || []);
        }
      } catch (err) {
        console.error('Catalog search failed:', err);
      } finally {
        setSearchingCatalog(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  const openLinkModal = (file: any) => {
    setLinkModalFile(file);
    const initialQuery = file.parsed_title || file.filename.replace(/\.[^/.]+$/, '');
    setCatalogSearch(initialQuery);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-lg ${
          notification.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800/80' 
            : 'bg-rose-950/90 text-rose-300 border border-rose-800/80'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderSearch className="w-7 h-7 text-indigo-400" />
            Automatic Media-to-Metadata Matching
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Recursively scans server music upload folders, extracts tags & normalized filenames, links high-confidence matches, and streams matched files securely.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isScanning ? (
            <button
              onClick={handleStopScan}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm flex items-center gap-2 transition"
            >
              <Pause className="w-4 h-4" />
              Pause Scan
            </button>
          ) : (
            <>
              <button
                onClick={() => runScanLoop(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
              >
                <Sparkles className="w-4 h-4" />
                Scan Now
              </button>

              <button
                onClick={() => runScanLoop(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium flex items-center gap-2 border border-zinc-700 transition"
              >
                <RotateCw className="w-4 h-4" />
                Resume Scan
              </button>
            </>
          )}

          <button
            onClick={() => { setStatusFilter('ambiguous'); setCurrentPage(1); }}
            className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 border transition ${
              statusFilter === 'ambiguous' 
                ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Review Ambiguous ({counts.ambiguous})
          </button>

          <button
            onClick={() => { setStatusFilter('unmatched'); setCurrentPage(1); }}
            className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 border transition ${
              statusFilter === 'unmatched' 
                ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            Review Unmatched ({counts.unmatched})
          </button>
        </div>
      </div>

      {/* Progress Bar (when scanning) */}
      {isScanning && (
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-indigo-200 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              Scanning server media files... (Batch #{scanProgress.currentBatch})
            </span>
            <span className="text-indigo-300 font-mono text-sm font-bold">
              {scanProgress.offset} / {scanProgress.total} ({scanProgress.percent}%)
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${scanProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div 
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Total Scanned</span>
            <FolderSearch className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {counts.total_scanned}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Found across storage</div>
        </div>

        <div 
          onClick={() => { setStatusFilter('matched'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'matched' 
              ? 'bg-emerald-950/40 border-emerald-600' 
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>Matched & Linked</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-2">
            {counts.matched}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">
            {counts.total_scanned > 0 ? `${Math.round((counts.matched / counts.total_scanned) * 100)}% match rate` : '0%'}
          </div>
        </div>

        <div 
          onClick={() => { setStatusFilter('ambiguous'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'ambiguous' 
              ? 'bg-amber-950/40 border-amber-600' 
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-amber-800/60'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
            <span>Ambiguous</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">
            {counts.ambiguous}
          </div>
          <div className="text-[11px] text-amber-500/80 mt-1">Review candidates</div>
        </div>

        <div 
          onClick={() => { setStatusFilter('unmatched'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'unmatched' 
              ? 'bg-purple-950/40 border-purple-600' 
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-purple-800/60'
          }`}
        >
          <div className="flex items-center justify-between text-purple-400 text-xs font-medium">
            <span>Unmatched</span>
            <HelpCircle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-2">
            {counts.unmatched}
          </div>
          <div className="text-[11px] text-purple-500/80 mt-1">Requires manual link</div>
        </div>

        <div 
          onClick={() => { setMediaFilter(mediaFilter === 'video' ? 'all' : 'video'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            mediaFilter === 'video' 
              ? 'bg-sky-950/40 border-sky-600' 
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-sky-800/60'
          }`}
        >
          <div className="flex items-center justify-between text-sky-400 text-xs font-medium">
            <span>Video Files</span>
            <Video className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-300 mt-2">
            {counts.video_files}
          </div>
          <div className="text-[11px] text-sky-500/80 mt-1">Protected media source</div>
        </div>

        <div 
          onClick={() => { setStatusFilter('error'); setCurrentPage(1); }}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            statusFilter === 'error' 
              ? 'bg-rose-950/40 border-rose-600' 
              : 'bg-zinc-900/80 border-zinc-800/80 hover:border-rose-800/60'
          }`}
        >
          <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
            <span>Errors / Other</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300 mt-2">
            {counts.error + counts.unsupported}
          </div>
          <div className="text-[11px] text-rose-500/80 mt-1">Unsupported/Corrupt</div>
        </div>
      </div>

      {/* Directory notice */}
      {scanDirectories.length > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <span>Active server scan paths:</span>
          <span className="font-mono text-zinc-300 truncate">
            {scanDirectories.join(' • ')}
          </span>
        </div>
      )}

      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filenames, parsed titles, artists, or server paths..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
            {['all', 'matched', 'ambiguous', 'unmatched'].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                  statusFilter === st 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
            {['all', 'audio', 'video'].map((m) => (
              <button
                key={m}
                onClick={() => { setMediaFilter(m); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                  mediaFilter === m 
                    ? 'bg-zinc-800 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Files List Table */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
                <th className="py-3 px-4">Media File Details</th>
                <th className="py-3 px-4">Parsed Metadata</th>
                <th className="py-3 px-4">Match Status & Confidence</th>
                <th className="py-3 px-4">Linked Track / Candidate Review</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading scanned media files...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-zinc-400">
                    <FolderSearch className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
                    No files found matching current filters. Click "Scan Now" to scan server directories.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const isPlayingThis = previewingFileId === file.id;
                  const isAudio = file.is_video === 0;

                  return (
                    <tr key={file.id} className="hover:bg-zinc-800/30 transition">
                      {/* 1. File Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => togglePreview(file)}
                            className={`p-2 rounded-xl mt-0.5 transition ${
                              isPlayingThis 
                                ? 'bg-indigo-600 text-white animate-pulse' 
                                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                            }`}
                            title={isPlayingThis ? 'Pause preview' : 'Play audio stream preview'}
                          >
                            {isPlayingThis ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>

                          <div className="min-w-0 max-w-[280px]">
                            <div className="font-medium text-white truncate text-sm" title={file.filename}>
                              {file.filename}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono truncate" title={file.file_path}>
                              {file.file_path}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                              <span className="uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                {file.file_extension}
                              </span>
                              <span>{formatSize(file.file_size)}</span>
                              {file.is_video === 1 && (
                                <span className="flex items-center gap-1 text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-800/50">
                                  <Video className="w-3 h-3" /> Video Source
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Parsed Metadata */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 text-xs">
                          {file.parsed_title ? (
                            <div className="text-zinc-200">
                              <span className="text-zinc-500">Title:</span> <span className="font-semibold">{file.parsed_title}</span>
                            </div>
                          ) : (
                            <div className="text-zinc-500 italic">No title parsed</div>
                          )}
                          {file.parsed_artist && (
                            <div className="text-zinc-400">
                              <span className="text-zinc-500">Artist:</span> {file.parsed_artist}
                            </div>
                          )}
                          {file.tag_title && (
                            <div className="text-[11px] text-indigo-400/90 font-mono">
                              TAG: {file.tag_title} {file.tag_artist ? `• ${file.tag_artist}` : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Match Status */}
                      <td className="py-3 px-4">
                        <div>
                          {file.match_status === 'matched' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Matched ({file.match_confidence}%)
                            </span>
                          )}

                          {file.match_status === 'ambiguous' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/80">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              Ambiguous ({file.match_confidence}%)
                            </span>
                          )}

                          {file.match_status === 'unmatched' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                              <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                              Unmatched
                            </span>
                          )}

                          {file.match_status === 'error' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/60 text-rose-300 border border-rose-800/80">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              Error
                            </span>
                          )}

                          {file.match_method && (
                            <div className="text-[11px] text-zinc-500 mt-1 capitalize">
                              Method: {file.match_method.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Linked Track / Candidate Review */}
                      <td className="py-3 px-4">
                        {file.matched_track_id && file.track_title ? (
                          <div className="flex items-center gap-3 bg-zinc-950/60 p-2 rounded-xl border border-zinc-800 max-w-[280px]">
                            {file.track_cover_art ? (
                              <img 
                                src={file.track_cover_art} 
                                alt="" 
                                className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500">
                                <Music className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate" title={file.track_title}>
                                {file.track_title}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate">
                                {file.track_artist_name}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                ID: {file.matched_track_id}
                              </div>
                            </div>
                          </div>
                        ) : file.candidates && file.candidates.length > 0 ? (
                          <div className="space-y-1.5 max-w-[300px]">
                            <div className="text-[11px] text-amber-400 font-medium">Suggested Candidates:</div>
                            {file.candidates.slice(0, 2).map((cand: any) => (
                              <div 
                                key={cand.track_id}
                                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs"
                              >
                                <div className="truncate min-w-0">
                                  <span className="font-semibold text-zinc-200">{cand.title}</span>
                                  <span className="text-zinc-500 text-[11px]"> • {cand.artist_name}</span>
                                </div>
                                <button
                                  onClick={() => handleManualLink(file.id, cand.track_id)}
                                  disabled={actionLoading === file.id}
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex-shrink-0 transition"
                                >
                                  Approve ({cand.score}%)
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No track linked</span>
                        )}
                      </td>

                      {/* 5. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openLinkModal(file)}
                            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 border border-zinc-700 transition"
                            title="Manually link or change track match"
                          >
                            <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                            {file.matched_track_id ? 'Change' : 'Link'}
                          </button>

                          {file.matched_track_id && (
                            <button
                              onClick={() => handleUnlink(file.id)}
                              disabled={actionLoading === file.id}
                              className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 border border-zinc-700/60 transition"
                              title="Unlink this file from track"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800 text-xs text-zinc-400 bg-zinc-950/20">
            <div>
              Showing {((currentPage - 1) * 25) + 1} to {Math.min(currentPage * 25, totalFiles)} of {totalFiles} files
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => loadFiles(currentPage - 1)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-zinc-300">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => loadFiles(currentPage + 1)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Link Modal */}
      {linkModalFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-400" />
                  Manual Match & Link Track
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-md">
                  File: <span className="font-mono text-zinc-200">{linkModalFile.filename}</span>
                </p>
              </div>
              <button 
                onClick={() => setLinkModalFile(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search existing music catalog by title, artist, or album..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                {searchingCatalog && (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            {/* Track Results List */}
            <div className="p-4 flex-1 overflow-y-auto divide-y divide-zinc-800/60 max-h-[420px]">
              {catalogResults.length === 0 && !searchingCatalog ? (
                <div className="text-center py-10 text-zinc-500 text-xs">
                  {catalogSearch.trim() ? 'No catalog tracks found matching search query.' : 'Type a song or artist name to search catalog.'}
                </div>
              ) : (
                catalogResults.map((track) => (
                  <div 
                    key={track.id} 
                    className="py-3 flex items-center justify-between gap-3 hover:bg-zinc-800/40 rounded-xl px-2 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {track.cover_art_url ? (
                        <img 
                          src={track.cover_art_url} 
                          alt="" 
                          className="w-11 h-11 rounded-lg object-cover bg-zinc-800 flex-shrink-0" 
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500">
                          <Music className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {track.title}
                        </div>
                        <div className="text-xs text-zinc-400 truncate">
                          {track.artist_name} {track.album_name ? `• ${track.album_name}` : ''}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          ID: {track.id} {track.local_audio_path ? '• Currently has linked audio' : ''}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleManualLink(linkModalFile.id, track.id)}
                      disabled={actionLoading === linkModalFile.id}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 flex-shrink-0 shadow transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Link Here
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
