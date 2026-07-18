import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Coins, 
  Clock as ClockIcon, 
  TrendingUp, 
  Sparkles, 
  Unlock, 
  Lock, 
  ShieldAlert, 
  Activity, 
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  Flame,
  PlusCircle,
  Plus,
  Compass
} from 'lucide-react';

// Hardcoded Factory details
const FACTORY_ADDRESS = '0x605501e50602111131a2367F6341BAd97B88dfFa';
const CHAIN_ID = 10143;
const RPC_URL = 'https://testnet-rpc.monad.xyz/';

const FACTORY_ABI = [
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_goalAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_durationInSeconds",
				"type": "uint256"
			}
		],
		"name": "createVault",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "vaultAddress",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "organizer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "goalAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "deadline",
				"type": "uint256"
			}
		],
		"name": "VaultCreated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "deployedVaults",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getDeployedVaults",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

const CHILD_ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_organizer",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_goalAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_durationInSeconds",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "contributions",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "currentBalance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "deadline",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "deposit",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "goalAmount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "organizer",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "refund",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "release",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "released",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

// Easing Helper for Number counter
function TickingCounter({ value, duration = 1.2 }) {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (isNaN(end) || end === 0) {
      setDisplayVal(0);
      return;
    }

    const startTime = performance.now();
    let animationFrameId;

    const updateNumber = (now) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Easing out cubic
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const current = easeOutCubic * end;
      setDisplayVal(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayVal(end);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return (
    <span>
      {displayVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
    </span>
  );
}

function App() {
  // Views Routing: 'lobby' or 'vault'
  const [view, setView] = useState('lobby');
  const [selectedVaultAddress, setSelectedVaultAddress] = useState(null);

  // Connection State
  const [account, setAccount] = useState(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Lobby State
  const [deployedVaults, setDeployedVaults] = useState([]);
  const [isLobbyLoading, setIsLobbyLoading] = useState(true);
  const [createForm, setCreateForm] = useState({
    target: '',
    durationHours: ''
  });
  const [isCreatingVault, setIsCreatingVault] = useState(false);

  // Vault Dashboard State
  const [vaultData, setVaultData] = useState({
    address: '',
    goalAmount: '0.0',
    currentBalance: '0.0',
    deadline: 0,
    released: false,
    organizer: '',
    userContribution: '0.0',
    loading: true
  });

  // Countdown State
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  const [depositAmount, setDepositAmount] = useState('');
  const [actionLoading, setActionLoading] = useState({
    deposit: false,
    release: false,
    refund: false
  });

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Session activity lists (mock logs seeded from vault address + user's current session deposits)
  const [activity, setActivity] = useState([]);

  const timerRef = useRef(null);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  };

  // Connect Web3 Wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      showToast("MetaMask or compatible injected wallet not detected!", "error");
      return;
    }
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      const userAccount = accounts[0];
      setAccount(userAccount);

      const chainIdNum = Number(network.chainId);
      if (chainIdNum !== CHAIN_ID) {
        setIsWrongNetwork(true);
        showToast("Please switch to Monad Testnet!", "warning");
        await requestNetworkSwitch();
      } else {
        setIsWrongNetwork(false);
        showToast("Wallet connected successfully!", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect Wallet
  const disconnectWallet = () => {
    setAccount(null);
    setIsWrongNetwork(false);
    showToast("Wallet disconnected.", "info");
    // Reload user-specific values
    if (view === 'vault') {
      setVaultData(prev => ({ ...prev, userContribution: '0.0' }));
    }
  };

  // Switch network helper
  const requestNetworkSwitch = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
      setIsWrongNetwork(false);
      showToast("Switched to Monad Testnet!", "success");
      reloadAllData();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${CHAIN_ID.toString(16)}`,
                chainName: 'Monad Testnet',
                nativeCurrency: {
                  name: 'MON',
                  symbol: 'MON',
                  decimals: 18
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ['https://testnet.monadexplorer.com/']
              },
            ],
          });
          setIsWrongNetwork(false);
          showToast("Monad Testnet added and connected!", "success");
          reloadAllData();
        } catch (addError) {
          showToast("Failed to add Monad Testnet to wallet.", "error");
        }
      } else {
        showToast("Failed to switch network.", "error");
      }
    }
  };

  const reloadAllData = () => {
    if (view === 'lobby') {
      fetchLobbyData();
    } else if (view === 'vault' && selectedVaultAddress) {
      fetchVaultData(selectedVaultAddress);
    }
  };

  // Fetch all deployed vaults for the lobby
  const fetchLobbyData = async () => {
    setIsLobbyLoading(true);
    try {
      const fallbackProvider = new ethers.JsonRpcProvider(RPC_URL);
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, fallbackProvider);

      const vaults = await factory.getDeployedVaults();
      
      // Query child details in parallel to render interactive cards
      const hydrated = await Promise.all(vaults.map(async (addr) => {
        try {
          const childContract = new ethers.Contract(addr, CHILD_ABI, fallbackProvider);
          const balanceWei = await childContract.currentBalance();
          const goalWei = await childContract.goalAmount();
          const deadlineSec = await childContract.deadline();
          const released = await childContract.released();
          const organizer = await childContract.organizer();

          const now = Math.floor(Date.now() / 1000);
          const deadlineNum = Number(deadlineSec);
          const timeExpired = deadlineNum <= now;

          return {
            address: addr,
            currentBalance: ethers.formatEther(balanceWei),
            goalAmount: ethers.formatEther(goalWei),
            deadline: deadlineNum,
            released,
            organizer,
            isExpired: timeExpired,
            valid: true
          };
        } catch (e) {
          console.warn("Child read failed for", addr, e);
          return { address: addr, valid: false };
        }
      }));

      // Filter out invalid reads and reverse to show newest first
      const validVaults = hydrated.filter(v => v.valid).reverse();
      setDeployedVaults(validVaults);
    } catch (err) {
      console.error("Lobby load failed:", err);
      showToast("Error loading active squad lairs.", "error");
    } finally {
      setIsLobbyLoading(false);
    }
  };

  // Create a new Lair Vault
  const handleCreateVault = async (e) => {
    e.preventDefault();
    if (!account) {
      showToast("Connect your wallet to launch a vault!", "warning");
      return;
    }
    if (isWrongNetwork) {
      await requestNetworkSwitch();
      return;
    }
    if (!createForm.target || parseFloat(createForm.target) <= 0) {
      showToast("Enter a valid MON target goal!", "warning");
      return;
    }
    if (!createForm.durationHours || parseFloat(createForm.durationHours) <= 0) {
      showToast("Enter a valid duration in hours!", "warning");
      return;
    }

    setIsCreatingVault(true);
    showToast("Constructing new Lair Vault transaction...", "loading");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

      const goalWei = ethers.parseEther(createForm.target);
      const durationSecs = Math.floor(parseFloat(createForm.durationHours) * 3600);

      const tx = await factory.createVault(goalWei, durationSecs);
      showToast("Launching Lair Vault! Waiting for block validation...", "loading");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        showToast("Lair Vault launched successfully! 🚀", "success");
        setCreateForm({ target: '', durationHours: '' });
        fetchLobbyData();
      } else {
        showToast("Vault creation transaction failed.", "error");
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'ACTION_REJECTED') {
        showToast("Transaction rejected in wallet.", "info");
      } else {
        showToast(err.message || "Failed to launch vault.", "error");
      }
    } finally {
      setIsCreatingVault(false);
    }
  };

  // Fetch specific vault details
  const fetchVaultData = async (vaultAddress) => {
    setVaultData(prev => ({ ...prev, loading: true }));
    try {
      const fallbackProvider = new ethers.JsonRpcProvider(RPC_URL);
      const childContract = new ethers.Contract(vaultAddress, CHILD_ABI, fallbackProvider);

      const [goalWei, balanceWei, deadlineSec, released, organizer] = await Promise.all([
        childContract.goalAmount(),
        childContract.currentBalance(),
        childContract.deadline(),
        childContract.released(),
        childContract.organizer()
      ]);

      let userContrib = '0.0';
      if (account) {
        const contribWei = await childContract.contributions(account);
        userContrib = ethers.formatEther(contribWei);
      }

      setVaultData({
        address: vaultAddress,
        goalAmount: ethers.formatEther(goalWei),
        currentBalance: ethers.formatEther(balanceWei),
        deadline: Number(deadlineSec),
        released,
        organizer,
        userContribution: userContrib,
        loading: false
      });

      calculateTimeLeft(Number(deadlineSec));

      // Generate seed-based mock squad members
      const seedMockActivity = generateSeedMockActivity(vaultAddress);
      setActivity(seedMockActivity);

    } catch (err) {
      console.error("Vault read failed:", err);
      showToast("Error loading vault parameters.", "error");
      setView('lobby');
    }
  };

  // Generate deterministic mock logs to make each vault's activity feed feel customized
  const generateSeedMockActivity = (vaultAddress) => {
    const seed = parseInt(vaultAddress.substring(2, 8), 16) || 42;
    const mockAccounts = [
      `0x${(seed * 3).toString(16).slice(0, 6)}...${(seed * 11).toString(16).slice(0, 4)}`,
      `0x${(seed * 7).toString(16).slice(0, 6)}...${(seed * 13).toString(16).slice(0, 4)}`,
      `0x${(seed * 17).toString(16).slice(0, 6)}...${(seed * 19).toString(16).slice(0, 4)}`
    ];
    return [
      { id: '1', contributor: mockAccounts[0], amount: ((seed % 8) + 1).toString(), mock: true },
      { id: '2', contributor: mockAccounts[1], amount: (((seed + 5) % 6) + 0.5).toString(), mock: true },
      { id: '3', contributor: mockAccounts[2], amount: (((seed + 12) % 4) + 2.0).toString(), mock: true }
    ];
  };

  // Ticking Countdown Calculations
  const calculateTimeLeft = (deadlineTimestamp) => {
    if (!deadlineTimestamp || deadlineTimestamp === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const diff = deadlineTimestamp - now;

    if (diff <= 0) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const days = Math.floor(diff / (3600 * 24));
    const hours = Math.floor((diff % (3600 * 24)) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    setTimeLeft({
      days,
      hours,
      minutes,
      seconds,
      isExpired: false
    });
  };

  // Start specific countdown clock
  useEffect(() => {
    if (view === 'vault' && vaultData.deadline > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      calculateTimeLeft(vaultData.deadline);
      timerRef.current = setInterval(() => {
        calculateTimeLeft(vaultData.deadline);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, vaultData.deadline]);

  // Navigate back to Lobby
  const navigateToLobby = () => {
    setView('lobby');
    setSelectedVaultAddress(null);
    setVaultData(prev => ({ ...prev, loading: true }));
    fetchLobbyData();
  };

  // Click handler to open a vault dashboard
  const navigateToVault = (addr) => {
    setSelectedVaultAddress(addr);
    setView('vault');
    fetchVaultData(addr);
  };

  // Toss in MON (Deposit)
  const handleDeposit = async () => {
    if (!account) {
      showToast("Connect your wallet first!", "warning");
      return;
    }
    if (isWrongNetwork) {
      await requestNetworkSwitch();
      return;
    }
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showToast("Please enter a valid MON amount!", "warning");
      return;
    }

    setActionLoading(prev => ({ ...prev, deposit: true }));
    showToast("Tossing in MON to the Stash...", "loading");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const childContract = new ethers.Contract(vaultData.address, CHILD_ABI, signer);

      const weiAmount = ethers.parseEther(depositAmount);

      const tx = await childContract.deposit({ value: weiAmount });
      showToast("Deposit submitted. Awaiting block validation...", "loading");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        showToast(`Successfully tossed in ${depositAmount} MON!`, "success");
        // Append user contribution to current session's log activity
        const newLog = {
          id: Date.now().toString(),
          contributor: `${account.substring(0, 6)}...${account.substring(account.length - 4)}`,
          amount: depositAmount,
          mock: false
        };
        setActivity(prev => [newLog, ...prev]);
        setDepositAmount('');
        fetchVaultData(vaultData.address);
      } else {
        showToast("Transaction failed.", "error");
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'ACTION_REJECTED') {
        showToast("Transaction rejected in wallet.", "info");
      } else {
        showToast(err.message || "Deposit transaction failed.", "error");
      }
    } finally {
      setActionLoading(prev => ({ ...prev, deposit: false }));
    }
  };

  // Pop the Vault (Release Funds)
  const handleRelease = async () => {
    if (!account) {
      showToast("Connect your wallet to trigger release!", "warning");
      return;
    }
    if (isWrongNetwork) {
      await requestNetworkSwitch();
      return;
    }

    setActionLoading(prev => ({ ...prev, release: true }));
    showToast("Popping the Vault... releasing funds to leader", "loading");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const childContract = new ethers.Contract(vaultData.address, CHILD_ABI, signer);

      const tx = await childContract.release();
      showToast("Release transaction submitted. Confirming...", "loading");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        showToast("Vault successfully popped! Funds sent to leader.", "success");
        fetchVaultData(vaultData.address);
      } else {
        showToast("Release transaction failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to pop vault.", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, release: false }));
    }
  };

  // Bail Out (Claim Refund)
  const handleRefund = async () => {
    if (!account) {
      showToast("Connect your wallet to claim refund!", "warning");
      return;
    }
    if (isWrongNetwork) {
      await requestNetworkSwitch();
      return;
    }

    setActionLoading(prev => ({ ...prev, refund: true }));
    showToast("Requesting a bailout refund...", "loading");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const childContract = new ethers.Contract(vaultData.address, CHILD_ABI, signer);

      const tx = await childContract.refund();
      showToast("Refund transaction submitted. Confirming...", "loading");

      const receipt = await tx.wait();
      if (receipt.status === 1) {
        showToast("Bailout successful! Your MON has been returned.", "success");
        fetchVaultData(vaultData.address);
      } else {
        showToast("Refund transaction failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to claim refund.", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, refund: false }));
    }
  };

  // Monitor Wallet state on start
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          showToast(`Wallet switched to ${accounts[0].substring(0, 6)}...`, "info");
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = (chainIdHex) => {
        const netChainId = parseInt(chainIdHex, 16);
        if (netChainId !== CHAIN_ID) {
          setIsWrongNetwork(true);
          showToast("Network changed! Switch back to Monad Testnet.", "warning");
        } else {
          setIsWrongNetwork(false);
          showToast("Network connected correctly.", "success");
        }
        reloadAllData();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [view, selectedVaultAddress]);

  // Initial load
  useEffect(() => {
    fetchLobbyData();
    // Poll data every 20 seconds
    const interval = setInterval(reloadAllData, 20000);
    return () => clearInterval(interval);
  }, [account]);

  // Progress Calculations for Vault Dashboard
  const totalRaisedVal = parseFloat(vaultData.currentBalance) || 0;
  const goalAmountVal = parseFloat(vaultData.goalAmount) || 0;
  const rawProgress = goalAmountVal > 0 ? (totalRaisedVal / goalAmountVal) * 100 : 0;
  const progressPercent = Math.min(Math.max(rawProgress, 0), 100);
  const isGoalReached = totalRaisedVal >= goalAmountVal;

  // Pulse Speed calculations for Hype emoji 🔥
  // 100% funded -> 0.2s duration (frenzied pulse), 0% funded -> 2.0s duration (slow pulse)
  const hypePulseDuration = Math.max(0.2, 2.0 - (progressPercent / 100) * 1.8);

  return (
    <div className="relative min-h-screen radial-bg selection:bg-brand-purple/40 selection:text-white px-4 md:px-8 py-6 flex flex-col justify-between overflow-hidden">
      
      {/* Toast notifications handler */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map(toast => (
          <motion.div 
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl border ${
              toast.type === 'success' ? 'bg-green-950/90 border-green-500/40 text-green-200' :
              toast.type === 'error' ? 'bg-red-950/90 border-red-500/40 text-red-200' :
              toast.type === 'warning' ? 'bg-amber-950/90 border-amber-500/40 text-amber-200' :
              toast.type === 'loading' ? 'bg-brand-card/95 border-brand-purple/40 text-purple-200' :
              'bg-brand-card-light/95 border-gray-700 text-gray-200'
            }`}
          >
            {toast.type === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand-purple" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-brand-cyan flex-shrink-0" />
            )}
            <div className="text-xs font-semibold leading-normal flex-1">{toast.message}</div>
          </motion.div>
        ))}
      </div>

      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-brand-purple/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-brand-cyan/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* HEADER CONTROLS */}
      <header className="relative w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-brand-purple/15 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={navigateToLobby}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-purple/20">
            <Coins className="w-6 h-6 text-brand-dark animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight font-grotesk bg-gradient-to-r from-brand-purple via-purple-300 to-brand-cyan bg-clip-text text-transparent m-0">
              GroupFund
            </h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
              Squad savings on autopilot.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div 
            onClick={isWrongNetwork ? requestNetworkSwitch : undefined}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 select-none ${
              isWrongNetwork 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse cursor-pointer' 
                : 'bg-brand-purple/10 border-brand-purple/30 text-brand-purple-light'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isWrongNetwork ? 'bg-red-500 animate-ping' : 'bg-gradient-to-r from-brand-purple to-brand-cyan'}`}></span>
            {isWrongNetwork ? 'Wrong Network (Switch)' : 'Monad Testnet'}
          </div>

          {account ? (
            <div className="flex items-center gap-1.5 bg-brand-card/90 border border-brand-purple/25 rounded-xl p-1 pr-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple/35 to-brand-cyan/20 flex items-center justify-center font-bold text-brand-cyan font-grotesk text-xs border border-brand-cyan/20">
                MON
              </div>
              <span className="text-xs font-grotesk text-gray-200 pl-1.5">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
              <button 
                onClick={disconnectWallet}
                className="ml-3 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-800 hover:bg-red-950/40 hover:text-red-400 hover:border-red-950 transition-all border border-gray-700 active:scale-95"
              >
                Exit
              </button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white hover:shadow-[0_0_20px_rgba(138,92,245,0.45)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Spinning Up...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </>
              )}
            </motion.button>
          )}
        </div>
      </header>

      {/* VIEWS SECTION */}
      <div className="relative w-full max-w-7xl mx-auto flex-1 my-8 z-10">
        <AnimatePresence mode="wait">
          
          {/* VIEW 1: LOBBY */}
          {view === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Launcher Form Panel */}
              <div className="lg:col-span-1">
                <div className="glow-card rounded-2xl p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <PlusCircle className="w-5 h-5 text-brand-purple" />
                      <h2 className="text-xl font-bold font-grotesk text-white m-0">Launch a Lair Vault</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                      Deploy your own custom savings contract on Monad. Specify the funding target and timeline duration.
                    </p>

                    <form onSubmit={handleCreateVault} className="space-y-5">
                      <div>
                        <label className="text-[10px] text-brand-purple-light font-bold uppercase tracking-wider block mb-2">Target Goal (MON)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 50.0"
                          value={createForm.target}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, target: e.target.value }))}
                          className="w-full bg-gray-950/60 border border-gray-800 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple rounded-xl py-3 px-4 text-sm font-bold font-grotesk text-white outline-none transition-all placeholder-gray-600"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-brand-purple-light font-bold uppercase tracking-wider block mb-2">Duration (Hours)</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="e.g. 24"
                          value={createForm.durationHours}
                          onChange={(e) => setCreateForm(prev => ({ ...prev, durationHours: e.target.value }))}
                          className="w-full bg-gray-950/60 border border-gray-800 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple rounded-xl py-3 px-4 text-sm font-bold font-grotesk text-white outline-none transition-all placeholder-gray-600"
                        />
                      </div>

                      <div className="pt-3">
                        <motion.button
                          type="submit"
                          disabled={isCreatingVault}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className="w-full py-3.5 rounded-xl font-extrabold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-brand-purple to-purple-600 hover:shadow-[0_0_20px_rgba(138,92,245,0.4)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isCreatingVault ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Launching Lair...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Create Vault
                            </>
                          )}
                        </motion.button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Active Lairs List Panel */}
              <div className="lg:col-span-2">
                <div className="glow-card rounded-2xl p-6 md:p-8 min-h-[400px]">
                  <div className="flex items-center justify-between mb-6 pb-3 border-b border-brand-purple/10">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-brand-cyan" />
                      <h2 className="text-xl font-bold font-grotesk text-white m-0">Active Squad Lairs</h2>
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase font-grotesk">
                      Factory Address: {FACTORY_ADDRESS.slice(0, 6)}...{FACTORY_ADDRESS.slice(-4)}
                    </span>
                  </div>

                  {isLobbyLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
                      <span className="text-xs font-semibold">Scanning Monad blockchain for Squad Lairs...</span>
                    </div>
                  ) : deployedVaults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <div className="w-14 h-14 rounded-full bg-gray-950 flex items-center justify-center border border-gray-800 text-gray-600 mb-4">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-300">No active lairs found</h3>
                      <p className="text-xs text-gray-500 max-w-xs mt-1 leading-normal">
                        Be the pioneer squad leader and launch the very first GroupFund vault above!
                      </p>
                    </div>
                  ) : (
                    <motion.div 
                      variants={{
                        hidden: { opacity: 0 },
                        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                      }}
                      initial="hidden"
                      animate="show"
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {deployedVaults.map((vault) => {
                        const filled = parseFloat(vault.currentBalance);
                        const target = parseFloat(vault.goalAmount);
                        const progress = target > 0 ? Math.min((filled / target) * 100, 100) : 0;
                        
                        return (
                          <motion.div
                            key={vault.address}
                            variants={{
                              hidden: { opacity: 0, y: 15 },
                              show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120 } }
                            }}
                            whileHover={{ 
                              scale: 1.025,
                              boxShadow: "0 0 25px rgba(138, 92, 245, 0.2)",
                              borderColor: "rgba(0, 242, 254, 0.45)"
                            }}
                            onClick={() => navigateToVault(vault.address)}
                            className="bg-brand-card/90 border border-brand-purple/15 rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden group"
                          >
                            {/* Inner Shimmer */}
                            <div className="shimmer absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity"></div>

                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <span className="text-[10px] text-brand-purple-light font-extrabold uppercase font-grotesk tracking-wider block">LAIR VAULT</span>
                                <span className="text-xs font-grotesk font-bold text-white group-hover:text-brand-cyan transition-colors">
                                  {vault.address.slice(0, 6)}...{vault.address.slice(-4)}
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border font-grotesk ${
                                vault.released 
                                  ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                                  : vault.isExpired 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                    : progress >= 100 
                                      ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' 
                                      : 'bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan'
                              }`}>
                                {vault.released ? 'RELEASED' : vault.isExpired ? 'FAILED' : progress >= 100 ? 'UNLOCKED' : 'ACTIVE'}
                              </span>
                            </div>

                            <div className="flex justify-between items-baseline mb-2">
                              <span className="text-xs text-gray-400 font-semibold">Stash:</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-base font-extrabold font-grotesk text-white">{vault.currentBalance}</span>
                                <span className="text-[10px] font-bold text-brand-cyan">/ {vault.goalAmount} MON</span>
                              </div>
                            </div>

                            {/* Small progress meter */}
                            <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden border border-brand-purple/5 p-0.5">
                              <div 
                                className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-cyan"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>

                            <div className="mt-4 flex justify-between items-center text-[10px] text-gray-500 font-medium">
                              <span>Leader: {vault.organizer.slice(0, 4)}...{vault.organizer.slice(-4)}</span>
                              <span>
                                {vault.isExpired ? "Expired" : `${Math.max(0, Math.ceil((vault.deadline - Math.floor(Date.now() / 1000)) / 3600))} hrs left`}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* VIEW 2: VAULT DASHBOARD */}
          {view === 'vault' && (
            <motion.div
              key="vault"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 25 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              
              {/* Left Column: Stats & Countdown (Span 2) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Back button & title header */}
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ x: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={navigateToLobby}
                    className="w-10 h-10 rounded-xl bg-brand-card hover:bg-brand-purple/20 border border-brand-purple/15 flex items-center justify-center text-brand-purple-light hover:text-white transition-all cursor-pointer shadow"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </motion.button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-semibold tracking-wider font-grotesk">SQUAD LAIR DASHBOARD</span>
                    </div>
                    <h2 className="text-lg font-bold font-grotesk text-white m-0">
                      Vault: {vaultData.address ? `${vaultData.address.slice(0, 10)}...${vaultData.address.slice(-6)}` : 'Loading...'}
                    </h2>
                  </div>
                </div>

                {vaultData.loading ? (
                  <div className="glow-card rounded-2xl p-12 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-cyan" />
                    <span className="text-xs font-semibold text-gray-400">Synchronizing Vault parameters with Monad node...</span>
                  </div>
                ) : (
                  <>
                    {/* The Stash & Hype Meter Card */}
                    <div className="glow-card rounded-2xl p-6 md:p-8 relative overflow-hidden">
                      <div className="shimmer absolute inset-0 opacity-15 pointer-events-none"></div>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                          <span className="text-[10px] font-extrabold tracking-widest text-brand-purple uppercase">THE STASH (CURRENT BALANCE)</span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-4xl md:text-5xl font-extrabold font-grotesk text-white">
                              <TickingCounter value={vaultData.currentBalance} />
                            </span>
                            <span className="text-lg font-bold text-brand-cyan">MON</span>
                          </div>
                        </div>

                        <div className="md:text-right">
                          <span className="text-[10px] font-extrabold tracking-widest text-gray-400 uppercase">THE VAULT (TARGET GOAL)</span>
                          <div className="flex items-baseline md:justify-end gap-1.5 mt-1">
                            <span className="text-2xl md:text-3xl font-extrabold font-grotesk text-gray-200">
                              {parseFloat(vaultData.goalAmount).toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-gray-400">MON</span>
                          </div>
                        </div>
                      </div>

                      {/* Animated Progress Meter */}
                      <div className="my-6">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                            <TrendingUp className="w-3.5 h-3.5 text-brand-cyan" />
                            <span>Hype Meter</span>
                          </div>
                          
                          {/* Pulsing Hype Emoji 🔥 */}
                          <div className="text-sm font-extrabold font-grotesk text-brand-cyan flex items-center gap-2">
                            <span 
                              className="pulse-custom inline-block" 
                              style={{ '--pulse-duration': `${hypePulseDuration}s` }}
                            >
                              🔥
                            </span>
                            <span>{rawProgress.toFixed(1)}% Funded</span>
                          </div>
                        </div>

                        {/* Bar */}
                        <div className="h-6 w-full bg-gray-950/60 rounded-full p-1 border border-brand-purple/10 overflow-hidden shadow-inner relative">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-brand-purple via-purple-500 to-brand-cyan rounded-full shadow-[0_0_15px_rgba(0,242,254,0.5)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-3 text-xs text-gray-400 font-medium">
                          <span>0 MON</span>
                          <span>{vaultData.goalAmount} MON Target</span>
                        </div>
                      </div>

                      {/* Small metadata details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-brand-purple/10">
                        <div className="bg-brand-card-light/40 border border-gray-800 rounded-xl p-3">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Squad Leader</span>
                          <span className="text-xs font-grotesk text-gray-300 block mt-1 truncate">
                            {vaultData.organizer}
                          </span>
                        </div>

                        <div className="bg-brand-card-light/40 border border-gray-800 rounded-xl p-3">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Explorer</span>
                          <a 
                            href={`https://testnet.monadexplorer.com/address/${vaultData.address}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs font-grotesk text-brand-purple-light hover:text-brand-cyan transition-colors flex items-center gap-1 mt-1 truncate"
                          >
                            Verify Contract
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        </div>
                      </div>

                    </div>

                    {/* The Clock Countdown Timer */}
                    <div className="glow-card rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold tracking-widest text-brand-purple uppercase flex items-center gap-1.5">
                          <ClockIcon className="w-3.5 h-3.5 text-brand-purple" />
                          THE CLOCK
                        </span>
                        <span className="text-xs font-medium text-gray-400">
                          Deadline: {vaultData.deadline > 0 ? new Date(vaultData.deadline * 1000).toLocaleString() : 'Loading...'}
                        </span>
                      </div>

                      {timeLeft.isExpired ? (
                        <div className="flex flex-col items-center justify-center py-6">
                          <span className="text-3xl font-extrabold text-red-500 font-grotesk tracking-widest uppercase text-glow-purple">
                            Time's Up
                          </span>
                          <span className="text-xs text-gray-500 mt-2">
                            The squad countdown timer has expired.
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto py-3">
                          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-950/40 border border-gray-800">
                            <span className="text-2xl md:text-3xl font-black font-grotesk text-white">
                              {timeLeft.days.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Days</span>
                          </div>

                          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-950/40 border border-gray-800">
                            <span className="text-2xl md:text-3xl font-black font-grotesk text-white">
                              {timeLeft.hours.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Hours</span>
                          </div>

                          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-950/40 border border-gray-800">
                            <span className="text-2xl md:text-3xl font-black font-grotesk text-white">
                              {timeLeft.minutes.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Mins</span>
                          </div>

                          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-950/40 border border-gray-800">
                            <span className="text-2xl md:text-3xl font-black font-grotesk text-brand-cyan text-glow-cyan animate-pulse">
                              {timeLeft.seconds.toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Secs</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>

              {/* Right Column: Toss In MON & Vault Controls */}
              <div className="flex flex-col gap-6">
                
                {/* Toss in MON Panel */}
                <div className="glow-card rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold tracking-widest text-brand-purple uppercase block mb-3">TOSS IN MON</span>
                    <p className="text-xs text-gray-400 mb-5 leading-relaxed">
                      Pool your MON tokens toward this lair's target. If the squad fails, get a full bailout refund.
                    </p>

                    {/* Inputs */}
                    <div className="space-y-4">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          disabled={timeLeft.isExpired || vaultData.released || vaultData.loading}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="input-focus-shimmer w-full bg-gray-950/60 border border-gray-800 focus:border-brand-purple focus:ring-1 focus:ring-brand-purple rounded-xl py-3.5 px-4 pr-16 text-lg font-bold font-grotesk text-white placeholder-gray-600 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <div className="absolute right-4 top-3.5 font-bold font-grotesk text-brand-cyan text-sm">
                          MON
                        </div>
                      </div>

                      {/* Shortcuts */}
                      <div className="grid grid-cols-4 gap-2">
                        {['0.1', '1', '5', '10'].map(val => (
                          <button
                            key={val}
                            type="button"
                            disabled={timeLeft.isExpired || vaultData.released || vaultData.loading}
                            onClick={() => setDepositAmount(val)}
                            className="py-1.5 rounded-lg text-xs font-semibold bg-brand-card hover:bg-brand-purple/20 hover:text-white text-gray-300 border border-gray-800 hover:border-brand-purple transition-all disabled:opacity-40"
                          >
                            +{val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-brand-purple/10">
                    <motion.button
                      type="button"
                      onClick={handleDeposit}
                      disabled={actionLoading.deposit || timeLeft.isExpired || vaultData.released || vaultData.loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3.5 rounded-xl font-extrabold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-brand-purple to-purple-600 hover:from-brand-purple-dark hover:to-purple-700 hover:shadow-[0_0_20px_rgba(138,92,245,0.4)] disabled:from-gray-800 disabled:to-gray-950 disabled:text-gray-500 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {actionLoading.deposit ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Tossing...
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4" />
                          Toss in MON
                        </>
                      )}
                    </motion.button>

                    <div className="flex justify-between items-center mt-4 px-1 text-xs">
                      <span className="text-gray-400 font-semibold">Your Contribution:</span>
                      <span className="font-extrabold font-grotesk text-brand-cyan">
                        {parseFloat(vaultData.userContribution).toFixed(4)} MON
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vault Controls Panel */}
                <div className="glow-card rounded-2xl p-6">
                  <span className="text-xs font-bold tracking-widest text-brand-purple uppercase block mb-3">VAULT CONTROLS</span>
                  
                  <div className="space-y-4">
                    {/* Pop the Vault button */}
                    {isGoalReached && !vaultData.released && !vaultData.loading && (
                      <div className="p-4 rounded-xl bg-green-950/20 border border-green-500/30">
                        <div className="flex items-center gap-2 text-green-400 font-bold text-xs mb-1">
                          <Unlock className="w-4 h-4" />
                          VAULT UNLOCKED
                        </div>
                        <p className="text-[10px] text-green-200/70 mb-3 leading-relaxed">
                          Squad target met! Pop the Vault to release the funds directly to the Leader's address.
                        </p>
                        <motion.button
                          type="button"
                          onClick={handleRelease}
                          disabled={actionLoading.release}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-3 rounded-lg font-bold text-xs bg-green-500 hover:bg-green-600 text-black transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.4)] cursor-pointer"
                        >
                          {actionLoading.release ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Popping...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Pop the Vault
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}

                    {/* Bail Out button */}
                    {timeLeft.isExpired && !isGoalReached && !vaultData.loading && (
                      <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-xs mb-1">
                          <ShieldAlert className="w-4 h-4" />
                          VAULT FAILED
                        </div>
                        <p className="text-[10px] text-red-200/70 mb-3 leading-relaxed">
                          Deadline passed without hitting target. Click to trigger your bailout refund.
                        </p>
                        <motion.button
                          type="button"
                          onClick={handleRefund}
                          disabled={actionLoading.refund}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-3 rounded-lg font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer"
                        >
                          {actionLoading.refund ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Bailing...
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Bail Out (Refund)
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}

                    {/* Standard locked state */}
                    {!timeLeft.isExpired && !isGoalReached && !vaultData.loading && (
                      <div className="flex items-center gap-3 p-4 bg-gray-950/40 border border-gray-800 rounded-xl">
                        <Lock className="w-5 h-5 text-gray-500" />
                        <div>
                          <span className="text-xs font-bold text-gray-300 block">Vault Locked</span>
                          <span className="text-[10px] text-gray-500 leading-relaxed block">
                            Controls unlock when goal is reached or clock runs out.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Already released state */}
                    {vaultData.released && !vaultData.loading && (
                      <div className="flex items-center gap-3 p-4 bg-green-950/20 border border-green-500/25 rounded-xl">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <div>
                          <span className="text-xs font-bold text-green-400 block">Funds Released</span>
                          <span className="text-[10px] text-green-300/60 leading-relaxed block">
                            The Vault was popped successfully! Funds were sent to the squad leader.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* FOOTER ACTIVITY FEED */}
      {view === 'vault' && !vaultData.loading && (
        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative w-full max-w-7xl mx-auto mt-6 pt-6 border-t border-brand-purple/10 z-10"
        >
          <div className="glow-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-brand-purple/10 pb-3">
              <span className="text-xs font-bold tracking-widest text-brand-purple uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-purple" />
                SQUAD ACTIVITY FEED
              </span>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                Recent Contributions
              </span>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {activity.map(act => (
                <div key={act.id} className="flex items-center justify-between bg-brand-card-light/30 border border-gray-800/80 rounded-xl px-4 py-2.5 hover:border-brand-purple/25 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-6.5 h-6.5 rounded-lg bg-brand-purple/15 flex items-center justify-center text-brand-purple-light">
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-200">
                        {act.contributor}
                      </span>
                      <span className="text-xs text-gray-400 font-medium pl-1.5">
                        tossed in <span className="font-extrabold text-brand-cyan">{act.amount} MON</span>
                      </span>
                      {act.mock && (
                        <span className="text-[8px] font-extrabold bg-brand-purple/10 border border-brand-purple/20 text-brand-purple-light px-1.5 py-0.5 rounded ml-2">
                          Squad Member
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.footer>
      )}

      {/* FOOTER METADATA */}
      <footer className="w-full max-w-7xl mx-auto mt-8 pt-4 border-t border-brand-purple/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500 font-medium pb-2">
        <span>&copy; {new Date().getFullYear()} GroupFund. Deployed on Monad Testnet.</span>
        <div className="flex items-center gap-3">
          <a href="https://monad.xyz" target="_blank" rel="noreferrer" className="hover:text-brand-cyan transition-colors flex items-center gap-1">
            Monad Network
            <ExternalLink className="w-3 h-3" />
          </a>
          <span>&bull;</span>
          <span className="text-brand-purple font-semibold">Squad savings on autopilot.</span>
        </div>
      </footer>

    </div>
  );
}

export default App;
