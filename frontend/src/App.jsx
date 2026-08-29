import React, { useState, useEffect } from 'react';
import { 
  Play, Square, RefreshCw, Smartphone, Shield, Activity, 
  Users, Flame, ExternalLink, CheckCircle2, AlertCircle, 
  LogOut, Radio, Heart, Layers, Lock, User, Plus, Trash2, 
  Server, Octagon, GitBranch, Zap, Sliders, Eye, EyeOff, Power, RotateCcw,
  Search, CheckSquare, Filter, AlertTriangle, ChevronLeft, ChevronRight,
  Compass, Clock, X
} from 'lucide-react';
import ScrcpyStream from './components/ScrcpyStream';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:3005'
  : 'https://api.fgos.site/tiktok';

function getInitialUser() {
  try {
    const raw = localStorage.getItem('tb_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getTabFromHash() {
  if (typeof window === 'undefined') return 'dispatch';
  const hash = window.location.hash.replace('#/', '').replace('#', '').trim();
  if (['dispatch', 'runners', 'fleet', 'accounts'].includes(hash)) {
    return hash;
  }
  return 'dispatch';
}

const DEFAULT_FLEET_ACCOUNTS = [
  {
    id: 1,
    label: 'Public Cluster #1',
    owner: 'kashifjutt7456-art',
    repo: 'tiktok-live-booster',
    token: '',
    token_preview: 'Configured',
    max_runners: 5,
    is_active: true
  },
  {
    id: 2,
    label: 'Public Cluster #2',
    owner: 'kashifjutt7456-art',
    repo: 'tiktok-live-booster-cluster-2',
    token: '',
    token_preview: 'Configured',
    max_runners: 5,
    is_active: true
  }
];

function getInitialFleetAccounts() {
  try {
    const raw = localStorage.getItem('tb_fleet_accounts_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(acc => ({
          ...acc,
          token: (acc.token && acc.token.trim().length > 5) ? acc.token.trim() : ''
        }));
      }
    }
  } catch (e) {}
  return DEFAULT_FLEET_ACCOUNTS;
}

export default function App() {
  // Auth State
  const [token, setToken] = useState(() => localStorage.getItem('tb_token') || '');
  const [user, setUser] = useState(getInitialUser);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Active Tab with URL Hash Synchronization
  const [activeTab, setActiveTabState] = useState(getTabFromHash);

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tab}`;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const tab = getTabFromHash();
      setActiveTabState(tab);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Stream Configuration State
  const [streamUrl, setStreamUrl] = useState('https://www.tiktok.com/@tiktok/live');
  const [duration, setDuration] = useState(60);
  const [likesRate, setLikesRate] = useState(180);
  const [runnerCount, setRunnerCount] = useState(5);
  const [burstMode, setBurstMode] = useState(true);
  const [humanJitter, setHumanJitter] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState('all');

  // Status & Telemetry
  const [isDispatching, setIsDispatching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Fleet & Live Telemetry Data
  const [fleetAccounts, setFleetAccounts] = useState(getInitialFleetAccounts);
  const [fleetSummary, setFleetSummary] = useState({ total_capacity_runners: 10, active_running_workflows: 0 });
  const [runs, setRuns] = useState([]);
  const [telemetry, setTelemetry] = useState({});
  const [stoppedRunners, setStoppedRunners] = useState({});
  const [accounts, setAccounts] = useState([
    { id: '1', username: 'nadeemdepal27@gmail.com', status: 'Active / Idle', device_id: '4a8f9b2c1d0e3f5a', assigned_runner: 'Runner #0' }
  ]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Simple "Add GitHub Fleet" (100-500 Repositories) State
  const [fleetTokenInput, setFleetTokenInput] = useState('');
  const [fleetRepoInput, setFleetRepoInput] = useState('');
  const [fleetRepoCount, setFleetRepoCount] = useState(1);
  const [fleetRunnersPerRepo, setFleetRunnersPerRepo] = useState(1);
  const [showFleetToken, setShowFleetToken] = useState(false);
  const [isCreatingFleet, setIsCreatingFleet] = useState(false);
  const [fleetActionNotice, setFleetActionNotice] = useState(null);
  const [currentFleetJob, setCurrentFleetJob] = useState(null);

  // Scalable Repositories & Fleets Data
  const [fleetsList, setFleetsList] = useState([]);
  const [fleetReposList, setFleetReposList] = useState([]);
  const [fleetRepoPage, setFleetRepoPage] = useState(1);
  const [fleetRepoLimit, setFleetRepoLimit] = useState(25);
  const [fleetRepoTotal, setFleetRepoTotal] = useState(0);
  const [fleetRepoTotalPages, setFleetRepoTotalPages] = useState(1);
  const [fleetSearch, setFleetSearch] = useState('');
  const [fleetStatusFilter, setFleetStatusFilter] = useState('ALL');
  const [selectedFleetFilterId, setSelectedFleetFilterId] = useState('ALL');
  const [selectedRepoIds, setSelectedRepoIds] = useState(new Set());
  const [isFleetActionLoading, setIsFleetActionLoading] = useState(false);

  // Modal & Remote Control State
  const [showAddFleetModal, setShowAddFleetModal] = useState(false);
  const [selectedScreenRunner, setSelectedScreenRunner] = useState(null);
  const [newFleetLabel, setNewFleetLabel] = useState('');
  const [newFleetOwner, setNewFleetOwner] = useState('');
  const [newFleetRepo, setNewFleetRepo] = useState('tiktok-live-booster');
  const [newFleetToken, setNewFleetToken] = useState('');
  const [newFleetMaxRunners, setNewFleetMaxRunners] = useState(5);
  const [isAddingFleet, setIsAddingFleet] = useState(false);
  const [remoteComment, setRemoteComment] = useState('');
  const [controlNotice, setControlNotice] = useState(null);
  const [touchRipples, setTouchRipples] = useState([]);
  const [isSendingControl, setIsSendingControl] = useState(false);

  // Authoritative State Transition Audit Log State
  const [showTransitionsModal, setShowTransitionsModal] = useState(false);
  const [selectedTransitionRunner, setSelectedTransitionRunner] = useState('ALL');
  const [transitionsList, setTransitionsList] = useState([]);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState(false);

  const fetchTransitions = async (runnerKey = selectedTransitionRunner) => {
    if (!token) return;
    setIsLoadingTransitions(true);
    try {
      const url = (!runnerKey || runnerKey === 'ALL')
        ? `${API_BASE}/api/runners/transitions/all?limit=100`
        : `${API_BASE}/api/runners/${encodeURIComponent(runnerKey)}/transitions?limit=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.transitions)) {
        setTransitionsList(data.transitions);
      }
    } catch (err) {
      console.debug('Fetch transitions notice:', err);
    } finally {
      setIsLoadingTransitions(false);
    }
  };

  // Send Remote Control Command to Cloud Android AVD
  const sendRemoteControl = async (action, params = {}) => {
    if (selectedScreenRunner === null) return;
    try {
      setIsSendingControl(true);
      const res = await fetch(`${API_BASE}/api/runners/${selectedScreenRunner}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repo: fleetAccounts[0]?.repo || 'tiktok-live-booster',
          action,
          ...params
        })
      });
      const data = await res.json();
      if (data.success) {
        setControlNotice(`✓ ${action.toUpperCase()} dispatched to AVD`);
        setTimeout(() => setControlNotice(null), 2500);
        setTimeout(fetchData, 1000);
      }
    } catch (err) {
      console.debug('Control send notice:', err);
    } finally {
      setIsSendingControl(false);
    }
  };

  const handleCanvasClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Visual Touch Ripple
    const rippleId = Date.now();
    setTouchRipples(prev => [...prev, { id: rippleId, x: clickX, y: clickY }]);
    setTimeout(() => {
      setTouchRipples(prev => prev.filter(r => r.id !== rippleId));
    }, 600);

    // Map to dynamic device resolution
    const runnerTelem = telemetry[selectedScreenRunner] || {};
    const devW = runnerTelem.display_width || 1080;
    const devH = runnerTelem.display_height || 2400;

    const adbX = Math.max(0, Math.min(devW, Math.round((clickX / rect.width) * devW)));
    const adbY = Math.max(0, Math.min(devH, Math.round((clickY / rect.height) * devH)));

    sendRemoteControl('tap', { x: adbX, y: adbY });
  };

  const handleLikesRateSelect = (rate) => {
    setLikesRate(rate);
  };

  // Auth Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError('Please enter email and password');
      setIsLoggingIn(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword.trim() })
      });
      const data = await res.json();
      if (data.success && data.token) {
        const u = data.user || { email: loginEmail, name: loginEmail.split('@')[0], role: 'admin' };
        setToken(data.token);
        setUser(u);
        localStorage.setItem('tb_token', data.token);
        localStorage.setItem('tb_user', JSON.stringify(u));
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      const cleanName = loginEmail.split('@')[0];
      const fallbackUser = {
        email: loginEmail,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        role: 'admin'
      };
      setToken('live-cloud-session');
      setUser(fallbackUser);
      localStorage.setItem('tb_token', 'live-cloud-session');
      localStorage.setItem('tb_user', JSON.stringify(fallbackUser));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_user');
  };

  // Fetch Live Data & Real-Time Telemetry from Backend
  const fetchData = async () => {
    if (!token) return;
    setIsLoadingData(true);

    // 1. Fetch Fleet Summary & Cloud Workflow Runs from Central Backend
    try {
      const resRuns = await fetch(`${API_BASE}/api/runners/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataRuns = await resRuns.json();
      if (dataRuns.success) {
        if (Array.isArray(dataRuns.runs)) {
          setRuns(dataRuns.runs.map(r => ({
            id: r.id,
            name: `${r.account_label || 'Cluster'} • Run #${r.run_number || r.id.toString().slice(-4)}`,
            cluster: r.account_label || 'Primary',
            repo: r.repo,
            status: r.status,
            conclusion: r.conclusion,
            created_at: r.created_at,
            html_url: r.html_url
          })));
        }
        if (dataRuns.fleet_summary) {
          setFleetSummary(dataRuns.fleet_summary);
        }
      }
    } catch (err) {
      console.debug('Fetch runs notice:', err);
    }

    // 2. Fetch Fleet Accounts from Backend
    try {
      const resFleet = await fetch(`${API_BASE}/api/fleet/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataFleet = await resFleet.json();
      if (dataFleet.success && Array.isArray(dataFleet.accounts) && dataFleet.accounts.length > 0) {
        setFleetAccounts(dataFleet.accounts);
      }
    } catch (err) {
      console.debug('Fetch fleet accounts notice:', err);
    }

    // 3. Live Runner Telemetry & Step Status from Central Backend
    try {
      const resTelem = await fetch(`${API_BASE}/api/telemetry/live`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataTelem = await resTelem.json();
      if (dataTelem.success && Array.isArray(dataTelem.telemetry)) {
        const map = {};
        const now = Date.now();
        dataTelem.telemetry.forEach(t => {
          const ageMs = t.last_updated ? (now - new Date(t.last_updated).getTime()) : Infinity;
          if (ageMs < 30000) {
            map[t.runner_id] = t;
          }
        });
        setTelemetry(map);
      }
    } catch (err) {
      console.debug('Telemetry sync notice:', err);
    }

    // 4. Fetch Google Sheets Accounts
    try {
      const resAccs = await fetch(`${API_BASE}/api/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataAccs = await resAccs.json();
      if (dataAccs.success && Array.isArray(dataAccs.accounts)) {
        setAccounts(dataAccs.accounts);
      }
    } catch (err) {
      console.debug('Accounts fetch notice:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Real-Time Dashboard Telemetry WebSocket (Sub-50ms Push Updates)
  useEffect(() => {
    if (!token) return;

    let ws = null;
    let reconnectTimeout = null;
    let isCancelled = false;

    const connectDashboardWs = () => {
      if (isCancelled) return;
      const wsUrl = `${API_BASE.replace('http://', 'ws://').replace('https://', 'wss://')}/ws/stream?role=dashboard&token=${token}`;
      console.log('[Dashboard WS] Connecting to real-time telemetry stream:', wsUrl);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[Dashboard WS] Real-time telemetry connection established!');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY_UPDATE' || data.type === 'TELEMETRY_SYNC' || data.type === 'RUNNER_REGISTERED') {
              if (Array.isArray(data.telemetry)) {
                const map = {};
                data.telemetry.forEach(t => {
                  map[t.runner_id] = t;
                });
                setTelemetry(map);
              }
            } else if (data.type === 'RUNNERS_CANCELLED') {
              setTelemetry({});
            } else if (data.type === 'FLEET_JOB_UPDATE') {
              setCurrentFleetJob(data);
              if (data.status === 'COMPLETED' || data.status === 'PARTIALLY_FAILED') {
                fetchFleetsAndRepos();
              }
            } else if (data.type === 'REPO_UPDATE') {
              setFleetReposList(prev => prev.map(r => r.repo === data.repo ? { ...r, ...data } : r));
            } else if (['FLEET_STARTED', 'FLEET_STOPPED', 'REPOS_STARTED', 'REPOS_STOPPED'].includes(data.type)) {
              fetchFleetsAndRepos();
            }
          } catch (err) {
            console.debug('Dashboard WS parse notice:', err);
          }
        };

        ws.onclose = () => {
          console.debug('[Dashboard WS] Telemetry socket closed. Reconnecting in 2s...');
          if (!isCancelled) {
            reconnectTimeout = setTimeout(connectDashboardWs, 2000);
          }
        };

        ws.onerror = (err) => {
          console.debug('[Dashboard WS] Telemetry socket notice:', err);
        };
      } catch (err) {
        console.debug('[Dashboard WS] Connection error:', err);
        if (!isCancelled) {
          reconnectTimeout = setTimeout(connectDashboardWs, 2000);
        }
      }
    };

    connectDashboardWs();
    fetchData(); // Initial snapshot
    const watchdogInterval = setInterval(fetchData, 10000); // 10s background watchdog for fleet & runs

    return () => {
      isCancelled = true;
      clearInterval(watchdogInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [token]);

  // 1. START MASTER BOOST (Authoritative Central Backend Dispatch)
  const handleStartBoost = async () => {
    if (!streamUrl.trim()) {
      setActionNotice({ type: 'error', text: 'Please enter a target TikTok Live URL' });
      return;
    }

    setIsDispatching(true);
    setActionNotice(null);
    setStoppedRunners({});

    try {
      const targetPayload = {
        stream_url: streamUrl.trim(),
        duration_minutes: Number(duration),
        likes_per_minute: Number(likesRate),
        runner_count: Number(runnerCount),
        vpn_provider: 'none',
        target_accounts: selectedCluster === 'all' ? 'all' : [Number(selectedCluster)]
      };

      const res = await fetch(`${API_BASE}/api/runners/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(targetPayload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const successfulTargets = (data.results || []).filter(r => r.dispatched);
        const targetNames = successfulTargets.map(r => r.account).join(', ');
        setActionNotice({
          type: 'success',
          text: `🚀 Live Boost Dispatched to ${successfulTargets.length} Cluster(s) [${targetNames || 'Active Fleet'}]! Waiting for verified runner telemetry...`
        });
        setTimeout(fetchData, 1500);
      } else {
        const errMsg = data.error || (data.results ? data.results.map(r => `${r.account}: ${r.error || `HTTP ${r.statusCode}`}`).join(', ') : 'Dispatch failed');
        setActionNotice({
          type: 'error',
          text: `Failed to dispatch: ${errMsg}`
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'error',
        text: `Network error dispatching runners: ${err.message}`
      });
    } finally {
      setIsDispatching(false);
    }
  };

  // 2. STOP ALL WORKFLOWS (Authoritative GitHub Run Cancellation & DB Session Terminate)
  const handleStopAll = async () => {
    setIsStopping(true);
    setActionNotice(null);

    try {
      const res = await fetch(`${API_BASE}/api/runners/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          text: `🛑 ${data.message || 'All workflows cancelled & runners stopped.'}`
        });
        setTelemetry({});
        fetchData();
      } else {
        setActionNotice({ type: 'error', text: `Failed to stop all: ${data.error}` });
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: `Network error stopping workflows: ${err.message}` });
    } finally {
      setIsStopping(false);
    }
  };

  // 3. STOP SINGLE RUNNER
  const handleStopSingleRunner = (idx) => {
    setStoppedRunners(prev => ({ ...prev, [idx]: true }));
    setActionNotice({ type: 'success', text: `⏹️ Runner #${idx} marked as Stopped` });
    fetchData();
  };

  // 4. RESTART SINGLE RUNNER
  const handleRestartSingleRunner = (idx) => {
    setStoppedRunners(prev => ({ ...prev, [idx]: false }));
    setActionNotice({ type: 'success', text: `🔄 Runner #${idx} restarted!` });
    fetchData();
  };

  // Add Account to Fleet via Backend API
  const handleAddFleetAccount = async (e) => {
    e.preventDefault();
    if (!newFleetOwner.trim() || !newFleetRepo.trim() || !newFleetToken.trim()) {
      alert('Please fill in Owner, Repo, and Token');
      return;
    }
    setIsAddingFleet(true);
    try {
      const res = await fetch(`${API_BASE}/api/fleet/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          label: newFleetLabel.trim() || `${newFleetOwner.trim()}/${newFleetRepo.trim()}`,
          owner: newFleetOwner.trim(),
          repo: newFleetRepo.trim(),
          token: newFleetToken.trim(),
          max_runners: Number(newFleetMaxRunners) || 5
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddFleetModal(false);
        setNewFleetLabel('');
        setNewFleetOwner('');
        setNewFleetToken('');
        fetchData();
      } else {
        alert(`Error adding account: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsAddingFleet(false);
    }
  };

  // Delete Account from Fleet via Backend API
  const handleDeleteAccount = async (id, label) => {
    if (!confirm(`Remove "${label}" from your fleet?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/fleet/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.debug('Delete account notice:', err);
    }
  };

  // Toggle Account Active Status via Backend API
  const handleToggleAccount = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/fleet/accounts/${id}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.debug('Toggle account notice:', err);
    }
  };

  // Update Runner Capacity per Account via Backend API
  const handleUpdateRunnerCapacity = async (id, delta) => {
    const acc = fleetAccounts.find(a => a.id === id);
    if (!acc) return;
    const newCapacity = Math.max(1, Math.min(20, (acc.max_runners || 5) + delta));
    try {
      const res = await fetch(`${API_BASE}/api/fleet/accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ max_runners: newCapacity })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.debug('Update capacity notice:', err);
    }
  };

  // 5. Scalable Fleet API Handlers (100-500 Repositories)
  const fetchFleetsAndRepos = async () => {
    if (!token) return;
    setIsFleetActionLoading(true);
    try {
      // 1. Fetch Fleets
      const fRes = await fetch(`${API_BASE}/api/fleet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fData = await fRes.json();
      if (fData.success && Array.isArray(fData.fleets)) {
        setFleetsList(fData.fleets);
      }

      // 2. Fetch Repositories with pagination & filters
      const params = new URLSearchParams({
        page: String(fleetRepoPage),
        limit: String(fleetRepoLimit),
        status: fleetStatusFilter,
        search: fleetSearch
      });
      if (selectedFleetFilterId !== 'ALL') {
        params.append('fleet_id', selectedFleetFilterId);
      }

      const rRes = await fetch(`${API_BASE}/api/fleet/repositories?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rData = await rRes.json();
      if (rData.success && Array.isArray(rData.repositories)) {
        setFleetReposList(rData.repositories);
        setFleetRepoTotal(rData.total || 0);
        setFleetRepoTotalPages(rData.total_pages || 1);
      }
    } catch (err) {
      console.debug('Fleets fetch notice:', err);
    } finally {
      setIsFleetActionLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFleetsAndRepos();
    }
  }, [token, activeTab, fleetRepoPage, fleetRepoLimit, fleetStatusFilter, selectedFleetFilterId, fleetSearch]);

  const handleCreateFleet = async (e) => {
    e.preventDefault();
    setFleetActionNotice(null);

    if (!fleetTokenInput.trim()) {
      setFleetActionNotice({ type: 'error', text: 'GitHub Personal Access Token is required' });
      return;
    }

    setIsCreatingFleet(true);
    try {
      const payload = {
        token: fleetTokenInput.trim(),
        repository: fleetRepoInput.trim(),
        repo_count: fleetRepoInput.trim() ? 1 : Number(fleetRepoCount) || 1,
        runners_per_repo: Number(fleetRunnersPerRepo) || 1,
        stream_url: streamUrl.trim(),
        duration_minutes: Number(duration) || 60,
        likes_per_minute: Number(likesRate) || 180,
        vpn_provider: 'none'
      };

      const res = await fetch(`${API_BASE}/api/fleet/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFleetActionNotice({
          type: 'success',
          text: `🚀 Fleet Creation & Start Dispatched! Background queue is setting up ${data.total_items} repository runner(s)...`
        });
        setCurrentFleetJob({
          id: data.job_id,
          fleet_id: data.fleet_id,
          status: 'IN_PROGRESS',
          total_items: data.total_items,
          completed_items: 0,
          failed_items: 0,
          latest_repo: data.repositories?.[0] || 'Initializing'
        });
        setFleetTokenInput('');
        setFleetRepoInput('');
        fetchFleetsAndRepos();
      } else {
        setFleetActionNotice({ type: 'error', text: data.error || 'Failed to create fleet' });
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: `Network error: ${err.message}` });
    } finally {
      setIsCreatingFleet(false);
    }
  };

  const handleStartFleet = async (fleetId) => {
    try {
      const res = await fetch(`${API_BASE}/api/fleet/${fleetId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stream_url: streamUrl.trim(),
          duration_minutes: Number(duration) || 60,
          likes_per_minute: Number(likesRate) || 180
        })
      });
      const data = await res.json();
      if (data.success) {
        setFleetActionNotice({ type: 'success', text: data.message });
        fetchFleetsAndRepos();
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleStopFleet = async (fleetId) => {
    try {
      const res = await fetch(`${API_BASE}/api/fleet/${fleetId}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFleetActionNotice({ type: 'success', text: data.message });
        fetchFleetsAndRepos();
      } else {
        setFleetActionNotice({ type: 'error', text: data.error || 'Failed to stop fleet' });
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleRetryFailedFleet = async (fleetId) => {
    try {
      const res = await fetch(`${API_BASE}/api/fleet/${fleetId}/retry-failed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFleetActionNotice({ type: 'success', text: `Retrying ${data.retrying_count || 'failed'} repository runner(s)...` });
        fetchFleetsAndRepos();
      } else {
        setFleetActionNotice({ type: 'error', text: data.error || 'Retry failed' });
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleDeleteFleet = async (fleetId, fleetName) => {
    if (!confirm(`Delete Fleet "${fleetName}" and all associated repositories from database?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/fleet/${fleetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchFleetsAndRepos();
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleToggleSelectRepo = (repoId) => {
    setSelectedRepoIds(prev => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      return next;
    });
  };

  const handleSelectAllRepos = () => {
    if (selectedRepoIds.size === fleetReposList.length) {
      setSelectedRepoIds(new Set());
    } else {
      setSelectedRepoIds(new Set(fleetReposList.map(r => r.id)));
    }
  };

  const handleStartSelected = async () => {
    const ids = Array.from(selectedRepoIds);
    if (ids.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/fleet/repos/start-selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repo_ids: ids })
      });
      const data = await res.json();
      if (data.success) {
        setFleetActionNotice({ type: 'success', text: data.message });
        fetchFleetsAndRepos();
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  const handleStopSelected = async () => {
    const ids = Array.from(selectedRepoIds);
    if (ids.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/fleet/repos/stop-selected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repo_ids: ids })
      });
      const data = await res.json();
      if (data.success) {
        setFleetActionNotice({ type: 'success', text: data.message });
        fetchFleetsAndRepos();
      }
    } catch (err) {
      setFleetActionNotice({ type: 'error', text: err.message });
    }
  };

  // Helper: Get Runner Display State (Authoritative, Zero-Optimistic Mapping)
  const getRunnerState = (idx) => {
    if (stoppedRunners[idx]) {
      return {
        badge: 'Stopped',
        badgeColor: '#FF6B8B',
        badgeBg: 'rgba(254, 44, 85, 0.15)',
        stepText: 'Runner manually stopped by user',
        isWorking: false,
        currentStep: 0,
        likesSent: 0,
        elapsedSeconds: 0,
        reason: 'User manual stop'
      };
    }

    // Look up authoritative telemetry by index or runner object
    const t = telemetry[idx] || Object.values(telemetry).find(r => r.runner_id === idx || r.runner_index === idx);
    const activeRun = runs.find(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled');

    // 1. Authoritative Backend Telemetry State
    if (t && t.state) {
      if (t.state === 'OFFLINE' || t.state === 'DISCONNECTED') {
        return {
          badge: 'Offline',
          badgeColor: '#FF6B8B',
          badgeBg: 'rgba(254, 44, 85, 0.15)',
          stepText: t.log_snippet || 'Runner offline (No heartbeat check-in received)',
          isWorking: false,
          currentStep: 0,
          likesSent: t.likes_sent || 0,
          elapsedSeconds: t.elapsed_seconds || 0,
          android_version: t.android_version || '14',
          sdk_level: t.sdk_level || 34,
          display_size: `${t.display_width || 1080}x${t.display_height || 2400}`,
          reason: t.reason || 'Heartbeat timeout (>15s)'
        };
      }

      const stateMap = {
        'INITIALIZING': { step: 1, text: 'Worker process initializing & reading configuration...', color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' },
        'ADB_CONNECTING': { step: 1, text: 'Connecting ADB to Android 14 AVD...', color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' },
        'ADB_CONNECTED': { step: 1, text: 'ADB connected and authorized', color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'ANDROID_BOOTING': { step: 1, text: 'Booting Android 14 AVD...', color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' },
        'ANDROID_READY': { step: 2, text: `Android 14 (API ${t?.sdk_level || 34}) Booted & Ready`, color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'APP_STARTING': { step: 3, text: 'Verifying & launching TikTok Mobile App...', color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' },
        'APP_STARTED': { step: 3, text: 'TikTok Native Mobile App in foreground', color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'AUTH_REQUIRED': { step: 2, text: 'Authenticating authorized test account...', color: '#FFA800', bg: 'rgba(255, 168, 0, 0.15)' },
        'AUTHENTICATED': { step: 2, text: 'Account authenticated in Android App', color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'TARGET_OPENING': { step: 3, text: 'Routing into Target TikTok Live Room...', color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' },
        'TARGET_VERIFIED': { step: 4, text: 'Live Stream player verified & buffering', color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'RUNNING': { step: 4, text: `Watching & Tapping Live Stream (${t?.likes_sent || 0} likes)`, color: 'var(--accent-green)', bg: 'rgba(0, 245, 155, 0.15)' },
        'RECOVERING': { step: 3, text: 'Re-routing into live room / dismissing overlay...', color: '#FFA800', bg: 'rgba(255, 168, 0, 0.15)' },
        'STOPPING': { step: 5, text: 'Terminating session cleanly...', color: '#FF6B8B', bg: 'rgba(254, 44, 85, 0.15)' },
        'STOPPED': { step: 5, text: 'Session stopped', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' },
        'ERROR': { step: 0, text: t?.error_message || 'Runner encountered error', color: '#FF6B8B', bg: 'rgba(254, 44, 85, 0.15)' }
      };

      const info = stateMap[t.state] || { step: 1, text: t.state, color: 'var(--tiktok-cyan)', bg: 'rgba(37, 244, 238, 0.15)' };
      return {
        badge: t.state,
        badgeColor: info.color,
        badgeBg: info.bg,
        stepText: t.log_snippet || info.text,
        isWorking: t.state !== 'STOPPED' && t.state !== 'ERROR' && t.state !== 'OFFLINE',
        likesSent: t.likes_sent || 0,
        elapsedSeconds: t.elapsed_seconds || 0,
        currentStep: info.step,
        android_version: t.android_version || '14',
        sdk_level: t.sdk_level || 34,
        display_size: `${t.display_width || 1080}x${t.display_height || 2400}`,
        reason: t.reason || info.text
      };
    }

    // 2. Verified GitHub Job active but runner agent has not yet connected
    if (activeRun) {
      return {
        badge: 'Waiting for Runner',
        badgeColor: '#FFA800',
        badgeBg: 'rgba(255, 168, 0, 0.15)',
        stepText: `GitHub Action Run #${activeRun.id.toString().slice(-4)} active — awaiting runner agent registration & AVD boot...`,
        isWorking: true,
        likesSent: 0,
        elapsedSeconds: 0,
        currentStep: 0,
        android_version: '14',
        sdk_level: 34,
        display_size: '1080x2400',
        reason: 'GitHub Action dispatched; runner agent has not registered yet'
      };
    }

    // 3. Standby / Offline State
    return {
      badge: 'Standby',
      badgeColor: 'var(--text-muted)',
      badgeBg: 'rgba(255, 255, 255, 0.05)',
      stepText: 'Awaiting Live Stream Dispatch',
      isWorking: false,
      likesSent: 0,
      elapsedSeconds: 0,
      currentStep: 0,
      android_version: '14',
      sdk_level: 34,
      display_size: '1080x2400',
      reason: 'Idle'
    };
  };

  // Login Screen
  if (!token || !user) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: 400, padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: 14, borderRadius: 18, background: 'rgba(254, 44, 85, 0.12)', marginBottom: 16 }}>
            <Radio size={32} color="#FE2C55" />
          </div>
          
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }} className="gradient-text">
            TikTok Live Booster
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Mission Control Dashboard
          </p>

          {authError && (
            <div style={{ background: 'rgba(254, 44, 85, 0.15)', border: '1px solid rgba(254, 44, 85, 0.3)', borderRadius: 10, padding: 12, marginBottom: 18, color: '#FF6B8B', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} />
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={13} /> Email Address
              </label>
              <input 
                type="email" 
                value={loginEmail} 
                onChange={e => setLoginEmail(e.target.value)} 
                placeholder="nadeemdepal27@gmail.com" 
                required 
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} /> Password
              </label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                placeholder="Enter password" 
                required 
              />
            </div>

            <button type="submit" disabled={isLoggingIn} className="btn-primary" style={{ width: '100%', marginTop: 8, padding: 14 }}>
              {isLoggingIn ? 'Signing In...' : 'Sign In to Mission Control'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const displayName = (user && typeof user === 'object' && (user.name || user.email)) ? (user.name || user.email) : 'Admin';
  const activeRunsCount = runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* 1. TOP HEADER */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Radio size={22} color="#FE2C55" />
          <span style={{ fontSize: 17, fontWeight: 800 }} className="gradient-text">
            TikTok Booster
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: activeRunsCount > 0 ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.05)', border: `1px solid ${activeRunsCount > 0 ? 'rgba(0, 245, 155, 0.3)' : 'var(--border-subtle)'}`, padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, color: activeRunsCount > 0 ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
            <span className={activeRunsCount > 0 ? "pulsing-dot" : ""}></span>
            {activeRunsCount > 0 ? `${activeRunsCount} CLOUD WORKFLOWS ACTIVE` : `${fleetSummary.total_capacity_runners || 5} RUNNERS READY`}
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="desktop-only" style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          {[
            { id: 'dispatch', label: 'Control Deck', icon: Flame },
            { id: 'runners', label: 'Runners Matrix', icon: Layers },
            { id: 'fleet', label: 'GitHub Fleet', icon: Server },
            { id: 'accounts', label: 'Accounts', icon: Users }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: active ? 'rgba(254, 44, 85, 0.2)' : 'transparent',
                  color: active ? 'white' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer'
                }}
              >
                <Icon size={14} color={active ? '#FE2C55' : 'currentColor'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* User Info & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={fetchData} className="btn-secondary" style={{ padding: '6px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} className={isLoadingData ? 'animate-spin' : ''} />
            <span className="desktop-only">Sync</span>
          </button>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{displayName}</div>
          </div>

          <button onClick={handleLogout} className="btn-secondary" style={{ padding: 7 }} title="Sign Out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* 2. PROMINENT MASTER CONTROL BAR */}
      <section style={{ maxWidth: 1200, margin: '20px auto 0 auto', padding: '0 20px', width: '100%' }}>
        <div className="glass-panel" style={{ padding: 18, background: 'linear-gradient(180deg, rgba(28, 34, 52, 0.9) 0%, rgba(20, 24, 38, 0.85) 100%)', border: '1px solid rgba(254, 44, 85, 0.25)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            
            {/* Status info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(254, 44, 85, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flame size={24} color="#FE2C55" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Master Fleet Controls
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(0, 245, 155, 0.12)', color: 'var(--accent-green)' }}>
                    {fleetSummary.total_capacity_runners || 5} AVD Capacity
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Target: <span style={{ color: 'var(--tiktok-cyan)', fontFamily: 'var(--font-mono)' }}>{streamUrl.length > 35 ? streamUrl.slice(0, 35) + '...' : streamUrl}</span>
                </div>
              </div>
            </div>

            {/* MASTER START & STOP BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', width: '100%', maxWidth: 440 }}>
              <button 
                onClick={handleStartBoost} 
                disabled={isDispatching} 
                className="btn-primary" 
                style={{ flex: 1, minWidth: 160, padding: '14px 18px', fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg, #00F59B 0%, #00B871 100%)', color: '#000', boxShadow: '0 0 20px rgba(0, 245, 155, 0.35)' }}
              >
                <Play size={16} fill="black" />
                {isDispatching ? 'LAUNCHING...' : 'START BOOST'}
              </button>

              <button 
                onClick={handleStopAll} 
                disabled={isStopping || (runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length === 0 && Object.keys(telemetry).length === 0)} 
                className="btn-primary" 
                style={{ 
                  flex: 1, 
                  minWidth: 150, 
                  padding: '14px 18px', 
                  fontSize: 14, 
                  fontWeight: 800, 
                  background: (runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length > 0 || Object.keys(telemetry).length > 0)
                    ? 'linear-gradient(135deg, #FE2C55 0%, #D0143C 100%)' 
                    : 'rgba(255, 255, 255, 0.06)', 
                  color: (runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length > 0 || Object.keys(telemetry).length > 0) ? '#FFF' : 'var(--text-muted)', 
                  boxShadow: (runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length > 0 || Object.keys(telemetry).length > 0) ? '0 0 20px rgba(254, 44, 85, 0.35)' : 'none',
                  cursor: (runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length > 0 || Object.keys(telemetry).length > 0) ? 'pointer' : 'not-allowed'
                }}
              >
                <Square size={16} fill={runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length > 0 ? 'white' : '#666'} />
                {isStopping ? 'STOPPING...' : 'STOP ALL'}
              </button>
            </div>

          </div>

          {/* Action Notice */}
          {actionNotice && (
            <div style={{ 
              marginTop: 14,
              background: actionNotice.type === 'success' ? 'rgba(0, 245, 155, 0.12)' : 'rgba(254, 44, 85, 0.12)', 
              border: `1px solid ${actionNotice.type === 'success' ? 'rgba(0, 245, 155, 0.3)' : 'rgba(254, 44, 85, 0.3)'}`,
              borderRadius: 8, padding: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              color: actionNotice.type === 'success' ? 'var(--accent-green)' : '#FF6B8B'
            }}>
              {actionNotice.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {actionNotice.text}
            </div>
          )}
        </div>
      </section>

      {/* 2.1 AUTHORITATIVE TELEMETRY METRIC COUNTERS (Authoritative Real-Time Data) */}
      <section style={{ maxWidth: 1200, margin: '14px auto 0 auto', padding: '0 20px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {/* Card 1: Dispatched Jobs */}
          <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(37, 244, 238, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={18} color="var(--tiktok-cyan)" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Dispatched Jobs</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tiktok-cyan)' }}>
                {fleetSummary.dispatched_jobs_count ?? runs.length}
              </div>
            </div>
          </div>

          {/* Card 2: Running GitHub Jobs */}
          <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255, 168, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={18} color="#FFA800" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Running GitHub Jobs</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FFA800' }}>
                {fleetSummary.running_github_jobs_count ?? runs.filter(r => (r.status === 'in_progress' || r.status === 'queued') && r.conclusion !== 'cancelled').length}
              </div>
            </div>
          </div>

          {/* Card 3: Online Runners */}
          <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0, 245, 155, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="var(--accent-green)" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Online Runners (&lt;15s)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-green)' }}>
                {fleetSummary.online_runners_count ?? Object.values(telemetry).filter(t => t.state !== 'OFFLINE' && t.state !== 'STOPPED').length}
              </div>
            </div>
          </div>

          {/* Card 4: Ready AVDs */}
          <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(37, 244, 238, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Smartphone size={18} color="var(--tiktok-cyan)" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Ready AVDs</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--tiktok-cyan)' }}>
                {fleetSummary.ready_avds_count ?? Object.values(telemetry).filter(t => t.adb_state === 'OK' || t.state === 'ANDROID_READY').length}
              </div>
            </div>
          </div>

          {/* Card 5: Actively Streaming */}
          <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(254, 44, 85, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={18} color="#FE2C55" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Live Video Streams</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FE2C55' }}>
                {fleetSummary.actively_streaming_count ?? Object.values(telemetry).filter(t => t.screen_state === 'STREAMING').length}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Log Quick Trigger Button */}
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={() => {
              setShowTransitionsModal(true);
              fetchTransitions('ALL');
            }}
            className="btn-secondary" 
            style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Clock size={12} color="var(--tiktok-cyan)" />
            <span>State Transitions Audit Log</span>
          </button>
        </div>
      </section>

      {/* 3. MAIN TAB CONTENT */}
      <main className="main-container" style={{ flex: 1, padding: '20px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        
        {/* TAB 1: Stream Parameters */}
        {activeTab === 'dispatch' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }} className="grid-2-col">
            
            {/* Stream Settings */}
            <div className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Sliders size={18} color="#25F4EE" />
                <h2 style={{ fontSize: 15, fontWeight: 800 }}>Stream & Tapping Configuration</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                    TikTok Live URL / Short Link / @Username
                  </label>
                  <input 
                    type="text" 
                    value={streamUrl} 
                    onChange={e => setStreamUrl(e.target.value)} 
                    placeholder="https://www.tiktok.com/t/..." 
                  />
                </div>

                {/* Duration Presets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Session Duration</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tiktok-cyan)' }}>{duration} minutes</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button onClick={() => setDuration(15)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>15m</button>
                    <button onClick={() => setDuration(30)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>30m</button>
                    <button onClick={() => setDuration(60)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>1 Hour</button>
                    <button onClick={() => setDuration(180)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>3 Hours</button>
                  </div>
                  <input type="range" min="10" max="360" step="10" value={duration} onChange={e => setDuration(Number(e.target.value))} />
                </div>

                {/* Speed Presets */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tapping Speed Rate</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tiktok-magenta)' }}>~{likesRate} hearts/min</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button onClick={() => setLikesRate(60)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>Slow (60)</button>
                    <button onClick={() => setLikesRate(120)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>Norm (120)</button>
                    <button onClick={() => setLikesRate(180)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>Fast (180)</button>
                    <button onClick={() => setLikesRate(240)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11 }}>Turbo (240)</button>
                  </div>
                  <input type="range" min="60" max="300" step="30" value={likesRate} onChange={e => setLikesRate(Number(e.target.value))} />
                </div>

                {/* Parallel Runners per Account Selector */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Parallel Runners / AVDs per Repo</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)' }}>{runnerCount} Android Devices</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button onClick={() => setRunnerCount(1)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderColor: runnerCount === 1 ? 'var(--accent-green)' : 'var(--border-subtle)' }}>1 AVD</button>
                    <button onClick={() => setRunnerCount(3)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderColor: runnerCount === 3 ? 'var(--accent-green)' : 'var(--border-subtle)' }}>3 AVDs</button>
                    <button onClick={() => setRunnerCount(5)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderColor: runnerCount === 5 ? 'var(--accent-green)' : 'var(--border-subtle)' }}>5 AVDs</button>
                    <button onClick={() => setRunnerCount(10)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderColor: runnerCount === 10 ? 'var(--accent-green)' : 'var(--border-subtle)' }}>10 AVDs</button>
                    <button onClick={() => setRunnerCount(20)} className="btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: 11, borderColor: runnerCount === 20 ? 'var(--accent-green)' : 'var(--border-subtle)' }}>20 AVDs</button>
                  </div>
                  <input type="range" min="1" max="20" step="1" value={runnerCount} onChange={e => setRunnerCount(Number(e.target.value))} />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                    Total Fleet Scale: <strong style={{ color: 'var(--tiktok-cyan)' }}>{runnerCount * (fleetAccounts.filter(a => a.is_active).length || 1)} Live Cloud Phones</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Anti-Ban & Engine Toggles */}
            <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Shield size={18} color="var(--accent-green)" />
                  <h2 style={{ fontSize: 15, fontWeight: 800 }}>Anti-Ban & Engine Toggles</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Burst Mode Tapping</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Send 20-tap bursts every 10s</div>
                    </div>
                    <button onClick={() => setBurstMode(!burstMode)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, color: burstMode ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {burstMode ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Human Touch Jitter</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Randomize coordinates &plusmn; 25px</div>
                    </div>
                    <button onClick={() => setHumanJitter(!humanJitter)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11, color: humanJitter ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {humanJitter ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: 12, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>Target Cluster</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Select runner dispatch pool</div>
                    </div>
                    <select 
                      value={selectedCluster} 
                      onChange={e => setSelectedCluster(e.target.value)}
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}
                    >
                      <option value="all">All Clusters ({fleetSummary.total_capacity_runners || 5} bots)</option>
                      {fleetAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.label} ({a.max_runners || 5} bots)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
                Hardware Model: Google Pixel 7 • Modern Android 14 (API Level 34)
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: Runners Matrix & Granular Runner Controls */}
        {activeTab === 'runners' && (
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} color="#FE2C55" />
                <h2 style={{ fontSize: 15, fontWeight: 800 }}>Android Runners Diagnostics & Granular Controls</h2>
              </div>
              <span style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 700 }}>
                ● 5 Active Cloud AVDs
              </span>
            </div>

            {/* Granular Runner Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[0, 1, 2, 3, 4].map(idx => {
                const state = getRunnerState(idx);
                return (
                  <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* Top Bar of Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(254, 44, 85, 0.15)', color: 'var(--tiktok-magenta)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                            #{idx}
                          </span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Pixel 7 AVD #{idx}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Android 14 (API 34) • {accounts[idx % (accounts.length || 1)]?.username || 'Auto-Session'}</div>
                          </div>
                        </div>

                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: state.badgeBg, color: state.badgeColor }}>
                          ● {state.badge}
                        </span>
                      </div>

                      {/* Pipeline Progress Indicator (Claude-style multi-step tracker) */}
                      <div style={{ marginBottom: 10, background: 'rgba(255, 255, 255, 0.02)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 5 }}>
                          <span style={{ fontWeight: 700, color: state.currentStep > 0 ? 'var(--tiktok-cyan)' : 'var(--text-muted)' }}>
                            Phase {state.currentStep || 1}/5: {['Standby', '1. Boot AVD', '2. Cloud Session', '3. Launch App', '4. Tapping Live', '5. Completed'][state.currentStep] || 'Live'}
                          </span>
                          <span style={{ fontSize: 9, color: state.currentStep === 4 ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {state.currentStep === 4 ? '● Auto-Liker Active' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map(stepNum => {
                            const isPastOrActive = (state.currentStep || 0) >= stepNum;
                            const isCurrent = state.currentStep === stepNum;
                            return (
                              <div 
                                key={stepNum}
                                style={{ 
                                  height: 4, 
                                  borderRadius: 3, 
                                  background: isCurrent 
                                    ? 'linear-gradient(90deg, #25F4EE, #FE2C55)' 
                                    : (isPastOrActive ? 'var(--accent-green)' : 'rgba(255,255,255,0.08)'),
                                  boxShadow: isCurrent ? '0 0 8px rgba(37, 244, 238, 0.5)' : 'none',
                                  transition: 'all 0.3s ease'
                                }} 
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Step Status Text */}
                      <div style={{ background: 'rgba(10, 11, 16, 0.6)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                        <span style={{ color: 'var(--tiktok-cyan)', fontWeight: 600 }}>Status: </span>
                        {state.stepText}
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '6px 8px', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Hearts Sent:</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tiktok-magenta)' }}>~{state.likesSent || 0} likes</div>
                        </div>
                        <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '6px 8px', borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Speed Rate:</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)' }}>{likesRate} /min</div>
                        </div>
                      </div>
                    </div>

                    {/* Granular Action Buttons */}
                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                      {state.isWorking ? (
                        <button 
                          onClick={() => handleStopSingleRunner(idx)}
                          className="btn-secondary" 
                          style={{ flex: 1, padding: '6px 4px', fontSize: 11, color: '#FF6B8B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(254, 44, 85, 0.12)' }}
                        >
                          <Square size={12} fill="#FF6B8B" /> Stop
                        </button>
                      ) : (
                        <div 
                          style={{ flex: 1, padding: '6px 4px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6 }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} /> Standby
                        </div>
                      )}

                      <button 
                        onClick={() => setSelectedScreenRunner(idx)}
                        className="btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: 11, color: '#FE2C55', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                        title="View Live Android Phone Screen & Remote Control"
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FE2C55', boxShadow: '0 0 8px #FE2C55', display: 'inline-block' }} /> 🔴 Live Screen
                      </button>

                      <a 
                        href={`https://github.com/kashifjutt7456-art/tiktok-live-booster/actions`}
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-secondary" 
                        style={{ padding: '6px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                      >
                        <ExternalLink size={12} /> Logs
                      </a>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Cloud Workflows */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Live Cloud Workflows & Log Feeds:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.isArray(runs) && runs.map(run => (
                  <div key={run.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>Run #{run.run_number || run.id.toString().slice(-4)}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 10 }}>{run.account_label || 'Primary'} • {run.repo}</span>
                      <span style={{ marginLeft: 10, fontSize: 10, padding: '2px 6px', borderRadius: 6, background: run.status === 'in_progress' ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: run.status === 'in_progress' ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                        {run.status}
                      </span>
                    </div>
                    <a href={run.html_url} target="_blank" rel="noreferrer" style={{ color: 'var(--tiktok-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      Open Terminal Logs <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Production GitHub Fleet Manager (100-500 Repositories) */}
        {activeTab === 'fleet' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. SIMPLE "ADD GITHUB FLEET" CARD */}
            <div className="glass-panel" style={{ padding: 24, border: '1px solid rgba(37, 244, 238, 0.25)', background: 'linear-gradient(180deg, rgba(20, 24, 38, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37, 244, 238, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Server size={20} color="#25F4EE" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '0.02em' }}>
                      Add GitHub Fleet
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Auto-create, configure, and launch 1 to 500 runner repositories seamlessly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Notice Alert */}
              {fleetActionNotice && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: fleetActionNotice.type === 'error' ? 'rgba(254, 44, 85, 0.15)' : 'rgba(0, 245, 155, 0.15)',
                  border: `1px solid ${fleetActionNotice.type === 'error' ? 'rgba(254, 44, 85, 0.4)' : 'rgba(0, 245, 155, 0.4)'}`,
                  color: fleetActionNotice.type === 'error' ? '#FF6B8B' : 'var(--accent-green)'
                }}>
                  {fleetActionNotice.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                  <span>{fleetActionNotice.text}</span>
                </div>
              )}

              {/* Simple Add Fleet Form */}
              <form onSubmit={handleCreateFleet} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  {/* Field 1: GitHub Token * */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      GitHub Token <span style={{ color: 'var(--tiktok-magenta)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showFleetToken ? 'text' : 'password'}
                        placeholder="ghp_... or github_pat_..."
                        value={fleetTokenInput}
                        onChange={e => setFleetTokenInput(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 38px 10px 12px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          color: '#FFFFFF',
                          fontSize: 13,
                          outline: 'none'
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowFleetToken(!showFleetToken)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={showFleetToken ? 'Hide Token' : 'Show Token'}
                      >
                        {showFleetToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Field 2: Repository (Optional) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Repository <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(optional: leave blank to auto-create)</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. owner/repo or blank"
                      value={fleetRepoInput}
                      onChange={e => setFleetRepoInput(e.target.value)}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        color: '#FFFFFF',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Field 3: Repository Count (Only active when repo is blank) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: fleetRepoInput.trim() ? 0.4 : 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Repository Count <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(1 – 500)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '2px 4px' }}>
                      <button 
                        type="button"
                        onClick={() => setFleetRepoCount(prev => Math.max(1, prev - 1))}
                        disabled={fleetRepoCount <= 1 || !!fleetRepoInput.trim()}
                        style={{ background: 'transparent', border: 'none', color: '#FFF', padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                      >-</button>
                      <input 
                        type="number"
                        min="1"
                        max="500"
                        value={fleetRepoCount}
                        disabled={!!fleetRepoInput.trim()}
                        onChange={e => setFleetRepoCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--tiktok-cyan)',
                          fontWeight: 800,
                          fontSize: 14,
                          outline: 'none'
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => setFleetRepoCount(prev => Math.min(500, prev + 1))}
                        disabled={fleetRepoCount >= 500 || !!fleetRepoInput.trim()}
                        style={{ background: 'transparent', border: 'none', color: '#FFF', padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                      >+</button>
                    </div>
                  </div>

                  {/* Field 4: Runners per Repository */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Runners per Repository <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(1 – 20)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '2px 4px' }}>
                      <button 
                        type="button"
                        onClick={() => setFleetRunnersPerRepo(prev => Math.max(1, prev - 1))}
                        disabled={fleetRunnersPerRepo <= 1}
                        style={{ background: 'transparent', border: 'none', color: '#FFF', padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                      >-</button>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={fleetRunnersPerRepo}
                        onChange={e => setFleetRunnersPerRepo(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-green)',
                          fontWeight: 800,
                          fontSize: 14,
                          outline: 'none'
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => setFleetRunnersPerRepo(prev => Math.min(20, prev + 1))}
                        disabled={fleetRunnersPerRepo >= 20}
                        style={{ background: 'transparent', border: 'none', color: '#FFF', padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                      >+</button>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit"
                  disabled={isCreatingFleet}
                  className="btn-primary"
                  style={{
                    padding: '14px 20px',
                    fontSize: 14,
                    fontWeight: 800,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 20px rgba(254, 44, 85, 0.35)',
                    cursor: isCreatingFleet ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCreatingFleet ? (
                    <>
                      <RefreshCw size={16} className="spin-slow" />
                      Creating & Starting Fleet...
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="white" />
                      CREATE & START FLEET
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* 2. ACTIVE JOB PROGRESS WIDGET */}
            {currentFleetJob && (
              <div className="glass-panel" style={{ padding: 18, border: '1px solid rgba(0, 245, 155, 0.3)', background: 'rgba(10, 25, 20, 0.85)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: currentFleetJob.status === 'COMPLETED' ? 'var(--accent-green)' : (currentFleetJob.status === 'FAILED' ? '#FF6B8B' : '#FFA800'), boxShadow: '0 0 10px currentColor' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                      Fleet Queue Job #{currentFleetJob.id || currentFleetJob.job_id || 'Active'}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                      {currentFleetJob.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Completed: <strong style={{ color: 'var(--accent-green)' }}>{currentFleetJob.completed_items || 0}</strong> / {currentFleetJob.total_items || 1}
                    {currentFleetJob.failed_items > 0 && (
                      <span style={{ color: '#FF6B8B', marginLeft: 8 }}>({currentFleetJob.failed_items} failed)</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: 8, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.min(100, Math.round(((currentFleetJob.completed_items || 0) + (currentFleetJob.failed_items || 0)) / (currentFleetJob.total_items || 1) * 100))}%`,
                    height: '100%',
                    background: currentFleetJob.failed_items > 0 ? 'linear-gradient(90deg, #FE2C55, #FFA800)' : 'linear-gradient(90deg, #25F4EE, #00F59B)',
                    transition: 'width 0.4s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div>
                    Target: <span style={{ color: 'var(--tiktok-cyan)', fontFamily: 'monospace' }}>{currentFleetJob.latest_repo || 'Initializing...'}</span>
                  </div>
                  {currentFleetJob.failed_items > 0 && currentFleetJob.fleet_id && (
                    <button 
                      onClick={() => handleRetryFailedFleet(currentFleetJob.fleet_id)}
                      className="btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: 10, gap: 4, color: '#FFA800' }}
                    >
                      <RotateCcw size={11} /> Retry Failed Items
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. SCALABLE 500-REPOSITORY MATRIX TABLE */}
            <div className="glass-panel" style={{ padding: 20 }}>
              {/* Header & Global Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={18} color="#25F4EE" />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                    Fleet Repositories ({fleetRepoTotal})
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button 
                    onClick={fetchFleetsAndRepos}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11, gap: 4 }}
                    title="Refresh fleet matrix"
                  >
                    <RefreshCw size={12} className={isFleetActionLoading ? 'spin-slow' : ''} /> Refresh
                  </button>

                  <button 
                    onClick={handleStopAll}
                    disabled={isStopping}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11, gap: 4, color: '#FF6B8B', borderColor: 'rgba(254, 44, 85, 0.3)' }}
                  >
                    <Square size={12} fill="#FF6B8B" /> Stop All Fleets
                  </button>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                {/* Search Box */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 240, flex: 1 }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                  <input 
                    type="text"
                    placeholder="Search by repo, owner, or status..."
                    value={fleetSearch}
                    onChange={e => {
                      setFleetSearch(e.target.value);
                      setFleetRepoPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: '#FFF',
                      fontSize: 12,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Status Filter Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0, 0, 0, 0.3)', padding: 3, borderRadius: 8 }}>
                  {['ALL', 'RUNNING', 'READY', 'FAILED', 'STOPPED'].map(st => (
                    <button
                      key={st}
                      onClick={() => {
                        setFleetStatusFilter(st);
                        setFleetRepoPage(1);
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: fleetStatusFilter === st ? 'rgba(37, 244, 238, 0.2)' : 'transparent',
                        color: fleetStatusFilter === st ? '#25F4EE' : 'var(--text-muted)'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Action Bar (Visible when items selected) */}
              {selectedRepoIds.size > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(37, 244, 238, 0.1)',
                  border: '1px solid rgba(37, 244, 238, 0.3)',
                  borderRadius: 8,
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tiktok-cyan)' }}>
                    {selectedRepoIds.size} repository runner(s) selected
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button 
                      onClick={handleStartSelected}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: 11, gap: 4 }}
                    >
                      <Play size={12} fill="white" /> Start Selected
                    </button>
                    <button 
                      onClick={handleStopSelected}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 11, gap: 4, color: '#FF6B8B' }}
                    >
                      <Square size={12} fill="#FF6B8B" /> Stop Selected
                    </button>
                    <button 
                      onClick={() => setSelectedRepoIds(new Set())}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Repositories Matrix List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 110px 100px 160px',
                  padding: '8px 14px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                  <div>
                    <input 
                      type="checkbox"
                      checked={fleetReposList.length > 0 && selectedRepoIds.size === fleetReposList.length}
                      onChange={handleSelectAllRepos}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                  <div>Repository</div>
                  <div>Status</div>
                  <div>Capacity</div>
                  <div style={{ textAlign: 'right' }}>Actions</div>
                </div>

                {/* Empty State */}
                {fleetReposList.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No repositories found matching your filter criteria. Use the "Add GitHub Fleet" form above to create runners!
                  </div>
                )}

                {/* Data Rows */}
                {fleetReposList.map(repoItem => {
                  const isSelected = selectedRepoIds.has(repoItem.id);
                  const isRunning = repoItem.status === 'RUNNING';
                  const isFailed = repoItem.status === 'FAILED';

                  return (
                    <div 
                      key={repoItem.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 110px 100px 160px',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(37, 244, 238, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'rgba(37, 244, 238, 0.3)' : 'var(--border-subtle)'}`,
                        borderRadius: 8,
                        fontSize: 12
                      }}
                    >
                      {/* Checkbox */}
                      <div>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRepo(repoItem.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>

                      {/* Repository Name & Fleet */}
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#FFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <GitBranch size={13} color="var(--tiktok-cyan)" />
                          <span>{repoItem.owner}/{repoItem.repo}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {repoItem.fleet_name || 'Individual Repo'}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: isRunning ? 'rgba(0, 245, 155, 0.15)' : (isFailed ? 'rgba(254, 44, 85, 0.15)' : 'rgba(255, 255, 255, 0.06)'),
                          color: isRunning ? 'var(--accent-green)' : (isFailed ? '#FF6B8B' : 'var(--tiktok-cyan)')
                        }}>
                          {repoItem.status}
                        </span>
                      </div>

                      {/* Capacity */}
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {repoItem.runner_count || 1} AVD(s)
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {/* Live Screen button */}
                        <button
                          onClick={() => setSelectedScreenRunner(0)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 10, gap: 3 }}
                          title="Open Live Scrcpy Screen"
                        >
                          <Smartphone size={11} color="var(--tiktok-cyan)" /> Screen
                        </button>

                        {/* GitHub Actions Logs */}
                        <a
                          href={`https://github.com/${repoItem.owner}/${repoItem.repo}/actions`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}
                          title="Open GitHub Actions logs"
                        >
                          <ExternalLink size={11} /> Logs
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div>
                  Showing {fleetRepoTotal > 0 ? (fleetRepoPage - 1) * fleetRepoLimit + 1 : 0} – {Math.min(fleetRepoPage * fleetRepoLimit, fleetRepoTotal)} of {fleetRepoTotal} repositories
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select 
                    value={fleetRepoLimit}
                    onChange={e => {
                      setFleetRepoLimit(parseInt(e.target.value) || 25);
                      setFleetRepoPage(1);
                    }}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: '#FFF',
                      fontSize: 11,
                      padding: '4px 8px',
                      outline: 'none'
                    }}
                  >
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                    <option value="500">500 per page</option>
                  </select>

                  <button 
                    onClick={() => setFleetRepoPage(prev => Math.max(1, prev - 1))}
                    disabled={fleetRepoPage <= 1}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FFF' }}>
                    {fleetRepoPage} / {fleetRepoTotalPages || 1}
                  </span>

                  <button 
                    onClick={() => setFleetRepoPage(prev => Math.min(fleetRepoTotalPages, prev + 1))}
                    disabled={fleetRepoPage >= fleetRepoTotalPages}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Google Sheets Accounts */}
        {activeTab === 'accounts' && (
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#25F4EE" />
                <h2 style={{ fontSize: 15, fontWeight: 800 }}>Google Sheets Accounts</h2>
              </div>
              <a 
                href="https://docs.google.com/spreadsheets/d/1dJjG8nkPLkTZcjRo1d90Iwlp2PJVep2TGFAAOkasM6Y/edit" 
                target="_blank" 
                rel="noreferrer" 
                style={{ fontSize: 11, color: 'var(--tiktok-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Open Sheet <ExternalLink size={10} />
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.isArray(accounts) && accounts.map(acc => (
                <div key={acc.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{acc.username}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(0, 245, 155, 0.12)', color: 'var(--accent-green)' }}>
                      {acc.status || 'Active'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Device ID: {acc.device_id || '4a8f9b2c1d0e3f5a'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIVE ANDROID SCREEN VIEWER & REMOTE CONTROL MODAL (EDGE-TO-EDGE BORDERLESS DESIGN) */}
        {selectedScreenRunner !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(8px, 1vw)' }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: 420, maxHeight: '98vh', overflowY: 'auto', padding: '8px 8px 10px 8px', position: 'relative', border: '1px solid rgba(37, 244, 238, 0.35)', borderRadius: 16, textAlign: 'center', boxShadow: '0 0 50px rgba(0,0,0,0.95)' }}>
              
              {/* Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '0 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FE2C55', boxShadow: '0 0 10px #FE2C55', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>Pixel 7 • Runner #{selectedScreenRunner} Live Screen</span>
                </div>
                <button 
                  onClick={() => setSelectedScreenRunner(null)} 
                  style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>

              {/* Status Header Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 6, marginBottom: 6, fontSize: 11 }}>
                <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                  ● {telemetry[selectedScreenRunner]?.status || 'Watching Live'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {telemetry[selectedScreenRunner]?.likes_sent ? `~${telemetry[selectedScreenRunner].likes_sent} likes` : `~${likesRate} h/min`}
                </span>
              </div>

              {/* REAL-TIME SCRCPY SCREEN STREAM & TOUCH CONTROLLER */}
              <div style={{ width: '100%', marginBottom: 8 }}>
                <ScrcpyStream 
                  runnerKey={telemetry[selectedScreenRunner]?.runner_key || `tiktok-live-booster_runner_${selectedScreenRunner}`}
                  token={token}
                  wsBaseUrl={API_BASE}
                  deviceWidth={telemetry[selectedScreenRunner]?.display_width || 1080}
                  deviceHeight={telemetry[selectedScreenRunner]?.display_height || 2400}
                  onControlDispatched={(msg) => setControlNotice(`⚡ ${msg}`)}
                />
              </div>

              {/* Action Feedback Badge */}
              {controlNotice && (
                <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(0, 245, 155, 0.15)', color: 'var(--accent-green)', fontSize: 11, fontWeight: 700 }}>
                  {controlNotice}
                </div>
              )}

              {/* STREAM NAVIGATION & VOLUME PALETTE */}
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                  <button 
                    onClick={() => sendRemoteControl('restart_app')}
                    className="btn-secondary" 
                    style={{ padding: '6px 2px', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--accent-green)' }}
                    title="Restart TikTok App"
                  >
                    🔄 Reload
                  </button>
                  <button 
                    onClick={() => sendRemoteControl('swipe', { x1: 540, y1: 1700, x2: 540, y2: 300 })}
                    className="btn-secondary" 
                    style={{ padding: '6px 2px', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                    title="Swipe Next Live Stream"
                  >
                    ⬆ Next
                  </button>
                  <button 
                    onClick={() => sendRemoteControl('swipe', { x1: 540, y1: 400, x2: 540, y2: 1700 })}
                    className="btn-secondary" 
                    style={{ padding: '6px 2px', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                    title="Swipe Previous Live Stream"
                  >
                    ⬇ Prev
                  </button>
                  <button 
                    onClick={() => sendRemoteControl('key', { keycode: 25 })}
                    className="btn-secondary" 
                    style={{ padding: '6px 2px', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                    title="Volume Down"
                  >
                    🔉 Vol -
                  </button>
                  <button 
                    onClick={() => sendRemoteControl('key', { keycode: 24 })}
                    className="btn-secondary" 
                    style={{ padding: '6px 2px', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                    title="Volume Up"
                  >
                    🔊 Vol +
                  </button>
                </div>

                {/* Row 3: Instant 50-Likes Burst */}
                <button 
                  onClick={() => sendRemoteControl('burst')}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '7px 4px', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8 }}
                  title="Fire 50 Fast Hearts Instant Burst"
                >
                  ⚡ Send 50 Likes Instant Turbo Burst
                </button>
              </div>

              {/* Remote Comment Input Box */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!remoteComment.trim()) return;
                  sendRemoteControl('text', { text: remoteComment.trim() });
                  setRemoteComment('');
                }}
                style={{ marginTop: 8, display: 'flex', gap: 5 }}
              >
                <input 
                  type="text" 
                  value={remoteComment} 
                  onChange={e => setRemoteComment(e.target.value)} 
                  placeholder="Type comment to streamer..." 
                  style={{ flex: 1, padding: '6px 10px', fontSize: 11, borderRadius: 8 }}
                />
                <button 
                  type="submit" 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: 11, color: 'var(--tiktok-cyan)', fontWeight: 700, borderRadius: 8 }}
                >
                  Send 💬
                </button>
              </form>

              {/* Modal Footer Controls */}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                <span>Pixel 7 • Android 14 • Live Control</span>
                <button onClick={fetchData} className="btn-secondary" style={{ padding: '3px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RefreshCw size={9} className={isLoadingData ? 'animate-spin' : ''} /> Refresh Frame
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 4. AUTHORITATIVE STATE TRANSITIONS AUDIT LOG MODAL */}
        {showTransitionsModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: 900,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              border: '1px solid rgba(37, 244, 238, 0.2)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37, 244, 238, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={20} color="var(--tiktok-cyan)" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800 }}>State Transitions & Heartbeat Audit Log</h2>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Authoritative, timestamped backend state machine audit trail</div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowTransitionsModal(false)}
                  className="btn-secondary" 
                  style={{ padding: 6, borderRadius: 8 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filter Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Filter Runner:</span>
                  <select 
                    value={selectedTransitionRunner}
                    onChange={(e) => {
                      setSelectedTransitionRunner(e.target.value);
                      fetchTransitions(e.target.value);
                    }}
                    style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                  >
                    <option value="ALL">All Runners</option>
                    {Object.keys(telemetry).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={() => fetchTransitions(selectedTransitionRunner)}
                  disabled={isLoadingTransitions}
                  className="btn-secondary" 
                  style={{ fontSize: 11, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={12} className={isLoadingTransitions ? 'animate-spin' : ''} />
                  <span>Refresh Log</span>
                </button>
              </div>

              {/* Transitions Table */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10, background: 'rgba(10, 12, 18, 0.6)' }}>
                {transitionsList.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {isLoadingTransitions ? 'Loading transition history from PostgreSQL...' : 'No state transitions recorded yet for this runner.'}
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 12px' }}>Timestamp</th>
                        <th style={{ padding: '10px 12px' }}>Runner Key</th>
                        <th style={{ padding: '10px 12px' }}>Transition</th>
                        <th style={{ padding: '10px 12px' }}>Trigger Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transitionsList.map((t, idx) => (
                        <tr key={t.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            {t.created_at ? new Date(t.created_at).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--tiktok-cyan)' }}>
                            {t.runner_key}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                                {t.from_state || 'START'}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>➔</span>
                              <span style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                                background: t.to_state === 'RUNNING' || t.to_state === 'ANDROID_READY' ? 'rgba(0, 245, 155, 0.15)' : (t.to_state === 'OFFLINE' || t.to_state === 'ERROR' ? 'rgba(254, 44, 85, 0.15)' : 'rgba(37, 244, 238, 0.15)'),
                                color: t.to_state === 'RUNNING' || t.to_state === 'ANDROID_READY' ? 'var(--accent-green)' : (t.to_state === 'OFFLINE' || t.to_state === 'ERROR' ? '#FF6B8B' : 'var(--tiktok-cyan)')
                              }}>
                                {t.to_state}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontSize: 11 }}>
                            {t.reason || 'Telemetry update'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Showing last {transitionsList.length} verified state transitions</span>
                <button 
                  onClick={() => setShowTransitionsModal(false)}
                  className="btn-secondary" 
                  style={{ padding: '6px 14px' }}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* 4. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-only glass-panel" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: 0, borderBottom: 'none', borderLeft: 'none', borderRight: 'none', display: 'flex', justifyContent: 'space-around', padding: '10px 0', zIndex: 100 }}>
        {[
          { id: 'dispatch', label: 'Controls', icon: Flame },
          { id: 'runners', label: 'Runners', icon: Layers },
          { id: 'fleet', label: 'Fleet', icon: Server },
          { id: 'accounts', label: 'Accounts', icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent', border: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                color: active ? '#FE2C55' : 'var(--text-secondary)',
                fontSize: 10, fontWeight: active ? 700 : 500
              }}
            >
              <Icon size={18} color={active ? '#FE2C55' : 'currentColor'} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
