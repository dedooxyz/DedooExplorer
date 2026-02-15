require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const pkg = require('./package.json');

const app = express();

// Configuration from environment
const config = {
    port: process.env.PORT || 3000,
    electrsApi: process.env.ELECTRS_API || 'http://127.0.0.1:50010',
    indexerApi: process.env.INDEXER_API || 'http://127.0.0.1:3070',
    // RPC for accurate hashrate (getmininginfo networkhashps)
    rpcUrl: process.env.RPC_URL || '',
    rpcUser: process.env.RPC_USER || '',
    rpcPassword: process.env.RPC_PASSWORD || '',
    explorerName: process.env.EXPLORER_NAME || 'DedooExplorer',
    coinName: process.env.COIN_NAME || 'Coin',
    coinTicker: process.env.COIN_TICKER || 'COIN',
    coinTagline: process.env.COIN_TAGLINE || 'A blockchain explorer',
    logoUrl: process.env.LOGO_URL || '/img/logo.png',
    websiteUrl: process.env.WEBSITE_URL || '',
    githubUrl: process.env.GITHUB_URL || '',
    telegramUrl: process.env.TELEGRAM_URL || '',
    twitterUrl: process.env.TWITTER_URL || '',
    discordUrl: process.env.DISCORD_URL || '',
    // Mining/Consensus
    algorithm: process.env.ALGORITHM || 'SHA256',
    diffAdjustment: process.env.DIFF_ADJUSTMENT || 'DGW3',
    blockTime: parseInt(process.env.BLOCK_TIME) || 120,
    softwareName: pkg.name,
    version: pkg.version
};

const PORT = config.port;
const ELECTRS_API = config.electrsApi;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Favicon - serve logo to avoid 404
app.get('/favicon.ico', (req, res) => res.redirect(301, '/img/wojak-logo.svg'));

// Rich List (register early to avoid 404)
app.get('/richlist', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    let holders = [];
    let totalHolders = 0;
    let indexerError = null;
    try {
        let holdersData;
        try {
            holdersData = await indexerApiCall(`/holders/top/${limit}`);
        } catch (e1) {
            try {
                holdersData = await indexerApiCall(`/holders?page=1&limit=${limit}`);
            } catch (e2) {
                indexerError = e2?.message || e1?.message || 'Indexer unavailable';
            }
        }
        if (holdersData && holdersData.holders) {
            holders = holdersData.holders.map((h, i) => ({ ...h, position: i + 1 }));
            totalHolders = holdersData.total != null ? holdersData.total : holders.length;
        }
    } catch (e) {
        indexerError = e.message || 'Failed to load holders';
    }
    let totalSupply = null;
    try {
        const supplyData = await apiCall('/blockchain/getsupply').catch(() => null);
        if (supplyData) totalSupply = supplyData.total_amount_float ?? supplyData.total_amount ?? null;
    } catch (_) {}
    try {
        return res.render('richlist', {
            title: 'Rich List',
            holders,
            totalHolders,
            totalSupply,
            limit: holders.length,
            indexerError,
            page: 'richlist'
        });
    } catch (err) {
        console.error('Rich list render error:', err);
        return res.status(500).render('error', { title: 'Error', message: 'Failed to render rich list', error: err.message, page: 'error' });
    }
});

// Make config available to all views
app.locals.config = config;

// Helper functions
const formatHash = (hash, length = 16) => {
    if (!hash) return '';
    return hash.length > length ? `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}` : hash;
};

const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTimeAgo = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
};

const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
};

const formatHashrate = (hashrate) => {
    if (hashrate == null || !Number.isFinite(hashrate) || hashrate < 0) return '0 H/s';
    if (hashrate >= 1e18) return (hashrate / 1e18).toFixed(2) + ' EH/s';
    if (hashrate >= 1e15) return (hashrate / 1e15).toFixed(2) + ' PH/s';
    if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
    if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
    if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
    if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
    return hashrate.toFixed(2) + ' H/s';
};

const formatDifficulty = (diff) => {
    if (diff >= 1e12) return (diff / 1e12).toFixed(2) + 'T';
    if (diff >= 1e9) return (diff / 1e9).toFixed(2) + 'B';
    if (diff >= 1e6) return (diff / 1e6).toFixed(2) + 'M';
    if (diff >= 1e3) return (diff / 1e3).toFixed(2) + 'K';
    return diff.toFixed(2);
};

const formatUptime = (seconds) => {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    if (s > 0 || parts.length === 0) parts.push(s + 's');
    return parts.join(' ');
};

const formatRate = (bytesPerSec) => {
    if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '—';
    if (bytesPerSec < 1 && bytesPerSec > 0) return bytesPerSec.toFixed(2) + ' B/s';
    if (bytesPerSec < 1024) return Math.round(bytesPerSec) + ' B/s';
    return formatBytes(bytesPerSec) + '/s';
};

// Make helpers available to all views
app.locals.formatHash = formatHash;
app.locals.formatNumber = formatNumber;
app.locals.formatBytes = formatBytes;
app.locals.formatTimeAgo = formatTimeAgo;
app.locals.formatDate = formatDate;
app.locals.formatHashrate = formatHashrate;
app.locals.formatDifficulty = formatDifficulty;
app.locals.formatUptime = formatUptime;
app.locals.formatRate = formatRate;

// API proxy helper
const apiCall = async (endpoint) => {
    try {
        const response = await axios.get(`${ELECTRS_API}${endpoint}`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`API Error for ${endpoint}:`, error.message);
        throw error;
    }
};

// Indexer API helper (holders, etc.)
const indexerApiCall = async (endpoint) => {
    try {
        const response = await axios.get(`${config.indexerApi}${endpoint}`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`Indexer API Error for ${endpoint}:`, error.message);
        throw error;
    }
};

// RPC call helper (for getmininginfo networkhashps - accurate hashrate)
const rpcCall = async (method, params = []) => {
    if (!config.rpcUrl || !config.rpcUser || !config.rpcPassword) return null;
    try {
        const response = await axios.post(config.rpcUrl, {
            jsonrpc: '1.0',
            id: 'explorer',
            method,
            params
        }, {
            timeout: 5000,
            auth: { username: config.rpcUser, password: config.rpcPassword },
            headers: { 'Content-Type': 'text/plain;' }
        });
        return response.data?.error ? null : response.data?.result;
    } catch (error) {
        console.error(`RPC Error ${method}:`, error.message);
        return null;
    }
};

// Get hashrate: prefer RPC networkhashps, fallback to block-based estimate
const getHashrate = async (blocks) => {
    const miningInfo = await rpcCall('getmininginfo');
    if (miningInfo != null && Number.isFinite(miningInfo.networkhashps) && miningInfo.networkhashps > 0) {
        return miningInfo.networkhashps;
    }
    // Fallback: estimate from difficulty and avg block time
    const blockTimeSec = blocks.length > 1
        ? Math.round((blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / (blocks.length - 1))
        : config.blockTime;
    const avgBlockTime = blockTimeSec > 0 ? blockTimeSec : config.blockTime;
    const latestDifficulty = blocks[0]?.difficulty || 0;
    return latestDifficulty > 0 && avgBlockTime > 0
        ? (latestDifficulty * Math.pow(2, 32)) / avgBlockTime
        : 0;
};

// ============ PAGES ============

// Dashboard
app.get('/', async (req, res) => {
    try {
        const [blocks, tipHeight, mempoolStats, mempoolRecent, supplyData] = await Promise.all([
            apiCall('/blocks'),
            apiCall('/blocks/tip/height'),
            apiCall('/mempool').catch(() => ({ count: 0, vsize: 0, total_fee: 0 })),
            apiCall('/mempool/recent').catch(() => [])
        ]);
        const supplyRes = await apiCall('/blockchain/getsupply').catch(() => ({ total_amount_float: 0 }));
        const supplyDataRes = supplyRes && typeof supplyRes === 'object' ? supplyRes : { total_amount_float: 0 };

        // Mempool count: use /mempool count (accurate), fallback to recent list length
        const mempoolCount = typeof mempoolStats?.count === 'number'
            ? mempoolStats.count
            : (Array.isArray(mempoolRecent) ? mempoolRecent.length : 0);

        // Calculate stats from recent blocks
        const blockTimeSec = blocks.length > 1
            ? Math.round((blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / (blocks.length - 1))
            : config.blockTime;
        const avgBlockTime = blockTimeSec > 0 ? blockTimeSec : config.blockTime;
        const latestDifficulty = blocks[0]?.difficulty || 0;

        // Hashrate: prefer RPC networkhashps (accurate), fallback to block-based estimate
        const hashrate = await getHashrate(blocks);

        res.render('index', {
            title: 'Dashboard',
            blocks: blocks.slice(0, 15),
            tipHeight,
            mempoolCount,
            difficulty: latestDifficulty,
            avgBlockTime,
            hashrate,
            supply: supplyDataRes.total_amount_float || supplyDataRes.total_amount || 0,
            page: 'dashboard'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load dashboard', error: error.message, page: 'error' });
    }
});

// Blocks list
app.get('/blocks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const tipHeight = await apiCall('/blocks/tip/height');
        const startHeight = tipHeight - ((page - 1) * 25);

        const blocks = await apiCall(`/blocks/${startHeight}`);
        const totalPages = Math.ceil((tipHeight + 1) / 25);

        res.render('blocks', {
            title: 'Blocks',
            blocks,
            currentPage: page,
            totalPages,
            tipHeight,
            page: 'blocks'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load blocks', error: error.message, page: 'error' });
    }
});

// Block detail
app.get('/block/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const txPage = parseInt(req.query.txPage) || 0;

        const [block, transactions] = await Promise.all([
            apiCall(`/block/${hash}`),
            apiCall(`/block/${hash}/txs/${txPage * 25}`)
        ]);

        // Get previous and next block hashes
        let prevBlock = null, nextBlock = null;
        if (block.previousblockhash) {
            prevBlock = block.previousblockhash;
        }
        // Try to get next block
        try {
            const nextBlockHash = await apiCall(`/block-height/${block.height + 1}`);
            nextBlock = nextBlockHash;
        } catch (e) {
            // No next block
        }

        const totalTxPages = Math.ceil(block.tx_count / 25);

        res.render('block', {
            title: `Block ${block.height}`,
            block,
            transactions,
            txPage,
            totalTxPages,
            prevBlock,
            nextBlock,
            page: 'blocks'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Block not found', error: error.message, page: 'error' });
    }
});

// Transactions list (mempool + recent)
app.get('/transactions', async (req, res) => {
    try {
        const mempool = await apiCall('/mempool/recent').catch(() => []);

        // Get recent confirmed transactions from latest blocks
        const blocks = await apiCall('/blocks');
        let recentTxs = [];

        for (const block of blocks.slice(0, 5)) {
            try {
                const txs = await apiCall(`/block/${block.id}/txs/0`);
                recentTxs = recentTxs.concat(txs.map(tx => ({
                    ...tx,
                    block_height: block.height,
                    block_time: block.timestamp
                })));
                if (recentTxs.length >= 25) break;
            } catch (e) {
                continue;
            }
        }

        res.render('transactions', {
            title: 'Transactions',
            mempool,
            recentTxs: recentTxs.slice(0, 25),
            page: 'transactions'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load transactions', error: error.message, page: 'error' });
    }
});

// Mempool page: stats + paginated pending txs with full detail (from electrs /mempool/txids + /tx/:id)
const MEMPOOL_PAGE_SIZE = 25;
const MEMPOOL_FETCH_CONCURRENCY = 10;

async function fetchMempoolTxDetails(electrsApi, txids) {
    const results = [];
    for (let i = 0; i < txids.length; i += MEMPOOL_FETCH_CONCURRENCY) {
        const chunk = txids.slice(i, i + MEMPOOL_FETCH_CONCURRENCY);
        const batch = await Promise.all(
            chunk.map((txid) =>
                axios.get(`${electrsApi}/tx/${txid}`, { timeout: 8000 }).then((r) => r.data).catch(() => null)
            )
        );
        results.push(...batch);
    }
    return results.filter(Boolean).map((tx) => {
        const value = (tx.vout || []).reduce((s, o) => s + (Number(o.value) || 0), 0);
        const vsize = tx.weight != null ? Math.ceil(Number(tx.weight) / 4) : null;
        return {
            txid: tx.txid,
            fee: tx.fee != null ? Number(tx.fee) : 0,
            vsize: vsize || 0,
            value,
        };
    });
}

app.get('/mempool', async (req, res) => {
    try {
        const startIndex = Math.max(0, parseInt(req.query.start_index, 10) || 0);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || MEMPOOL_PAGE_SIZE));

        const [stats, txidsPayload] = await Promise.all([
            apiCall('/mempool').catch(() => ({ count: 0, vsize: 0, total_fee: 0, fee_histogram: [] })),
            apiCall(`/mempool/txids?start_index=${startIndex}&limit=${limit}`).catch(() => ({ txids: [], total: 0, start_index: 0, limit: 0 })),
        ]);

        const txids = txidsPayload.txids || [];
        const total = typeof txidsPayload.total === 'number' ? txidsPayload.total : txids.length;
        const pending = txids.length > 0 ? await fetchMempoolTxDetails(ELECTRS_API, txids) : [];

        res.render('mempool', {
            title: 'Mempool',
            stats,
            feeHistogram: stats.fee_histogram || [],
            pending,
            total,
            startIndex,
            limit,
            page: 'mempool',
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load mempool', error: error.message, page: 'error' });
    }
});

// Transaction detail
app.get('/tx/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        const [tx, rawHex] = await Promise.all([
            apiCall(`/tx/${txid}`),
            axios.get(`${ELECTRS_API}/tx/${txid}/hex`, { timeout: 5000 }).then(r => r.data).catch(() => null)
        ]);

        // Calculate totals
        let totalInput = 0, totalOutput = 0;
        tx.vin.forEach(vin => {
            if (vin.prevout && vin.prevout.value) {
                totalInput += vin.prevout.value;
            }
        });
        tx.vout.forEach(vout => {
            totalOutput += vout.value || 0;
        });

        // Derived fields for extreme detail view
        const vsize = tx.weight != null ? Math.ceil(Number(tx.weight) / 4) : (tx.size || 0);
        const feeRateSatPerVb = tx.fee != null && vsize ? (Number(tx.fee) / vsize).toFixed(2) : null;
        const locktimeInterpretation = tx.locktime != null
            ? (tx.locktime < 500000000
                ? `Block height ${formatNumber(tx.locktime)}`
                : `Unix time ${tx.locktime} (${new Date(tx.locktime * 1000).toISOString()} UTC)`)
            : null;

        res.render('transaction', {
            title: `Transaction ${formatHash(txid)}`,
            tx,
            totalInput,
            totalOutput,
            rawHex: typeof rawHex === 'string' ? rawHex : null,
            vsize,
            feeRateSatPerVb,
            locktimeInterpretation,
            page: 'transactions'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Transaction not found', error: error.message, page: 'error' });
    }
});

// Address detail
app.get('/address/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const page = parseInt(req.query.page) || 0;
        const utxoPage = parseInt(req.query.utxo_page) || 0;

        // Fetch address info and transactions
        const [addressInfo, txsData] = await Promise.all([
            apiCall(`/address/${address}`),
            apiCall(`/address/${address}/txs?start_index=${page * 25}&limit=25`)
        ]);

        // Fetch UTXOs with pagination (separate try-catch for graceful degradation)
        let utxos = [];
        let totalUtxos = 0;
        let utxoError = null;
        try {
            const utxoData = await apiCall(`/address/${address}/utxo?start_index=${utxoPage * 25}&limit=25`);
            utxos = utxoData.utxos || utxoData || [];
            totalUtxos = utxoData.total || utxos.length;
        } catch (err) {
            utxoError = err.message;
            // If UTXOs fail, still show address with empty UTXOs
        }

        // Handle different response formats
        const transactions = txsData.transactions || txsData;
        const totalTxs = txsData.total || addressInfo.chain_stats?.tx_count || 0;

        // Calculate balance
        const chainStats = addressInfo.chain_stats || {};
        const mempoolStats = addressInfo.mempool_stats || {};
        const confirmedBalance = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
        const pendingBalance = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);

        res.render('address', {
            title: `Address ${formatHash(address)}`,
            address,
            addressInfo,
            transactions,
            utxos,
            totalUtxos,
            utxoPage,
            utxoError,
            confirmedBalance,
            pendingBalance,
            totalTxs,
            currentPage: page,
            totalPages: Math.ceil(totalTxs / 25),
            page: 'address'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Address not found', error: error.message, page: 'error' });
    }
});

// Nodes page
app.get('/nodes', async (req, res) => {
    try {
        const networkData = await indexerApiCall('/network');
        res.render('nodes', {
            title: 'Nodes',
            network: networkData,
            page: 'nodes'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load node info', error: error.message, page: 'error' });
    }
});

// Chain Tips / Forks page
app.get('/chain-tips', async (req, res) => {
    try {
        const chainTips = await rpcCall('getchaintips');
        const tipHeight = await apiCall('/blocks/tip/height');
        
        res.render('chain-tips', {
            title: 'Chain Tips',
            chainTips: chainTips || [],
            tipHeight,
            page: 'chain-tips'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load chain tips', error: error.message, page: 'error' });
    }
});

// Reorg History page
app.get('/reorgs', async (req, res) => {
    try {
        const chainTips = await rpcCall('getchaintips');
        const tipHeight = await apiCall('/blocks/tip/height');
        const blocks = await apiCall('/blocks');
        
        // Analyze chain tips to identify potential reorgs
        const reorgs = [];
        if (chainTips && Array.isArray(chainTips)) {
            chainTips.forEach(tip => {
                if (tip.status === 'valid-fork' || tip.status === 'valid-headers') {
                    reorgs.push({
                        height: tip.height,
                        hash: tip.hash,
                        branchlen: tip.branchlen || 0,
                        status: tip.status,
                        forkHeight: tip.height - (tip.branchlen || 0)
                    });
                }
            });
        }
        
        res.render('reorgs', {
            title: 'Reorg History',
            reorgs: reorgs.sort((a, b) => b.height - a.height),
            tipHeight,
            page: 'reorgs'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load reorg history', error: error.message, page: 'error' });
    }
});

// Orphaned Blocks page
app.get('/orphans', async (req, res) => {
    try {
        const chainTips = await rpcCall('getchaintips');
        const tipHeight = await apiCall('/blocks/tip/height');
        
        // Find orphaned blocks (valid-fork, valid-headers that aren't active)
        const orphans = [];
        if (chainTips && Array.isArray(chainTips)) {
            chainTips.forEach(tip => {
                if (tip.status === 'valid-fork' || tip.status === 'valid-headers') {
                    orphans.push({
                        height: tip.height,
                        hash: tip.hash,
                        branchlen: tip.branchlen || 0,
                        status: tip.status
                    });
                }
            });
        }
        
        res.render('orphans', {
            title: 'Orphaned Blocks',
            orphans: orphans.sort((a, b) => b.height - a.height),
            tipHeight,
            page: 'orphans'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load orphaned blocks', error: error.message, page: 'error' });
    }
});

// Chain Health page
app.get('/chain-health', async (req, res) => {
    try {
        const [blockchainInfo, networkInfo, miningInfo, tipHeight] = await Promise.all([
            rpcCall('getblockchaininfo'),
            rpcCall('getnetworkinfo'),
            rpcCall('getmininginfo'),
            apiCall('/blocks/tip/height')
        ]);
        
        const syncProgress = blockchainInfo?.verificationprogress || 0;
        const blocksBehind = blockchainInfo ? (blockchainInfo.headers - blockchainInfo.blocks) : 0;
        const isSynced = blocksBehind === 0 && syncProgress >= 0.999;
        
        res.render('chain-health', {
            title: 'Chain Health',
            blockchainInfo: blockchainInfo || {},
            networkInfo: networkInfo || {},
            miningInfo: miningInfo || {},
            tipHeight,
            syncProgress: (syncProgress * 100).toFixed(2),
            blocksBehind,
            isSynced,
            page: 'chain-health'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load chain health', error: error.message, page: 'error' });
    }
});

// Network Traffic page (detailed network: bandwidth, rates, connection breakdown, fees — no peer list; see Nodes for peers)
app.get('/network-traffic', async (req, res) => {
    try {
        const [netTotals, networkInfo, mempoolStats] = await Promise.all([
            rpcCall('getnettotals'),
            rpcCall('getnetworkinfo'),
            apiCall('/mempool').catch(() => ({ count: 0, vsize: 0, total_fee: 0 }))
        ]);

        const totals = netTotals || {};
        const recv = totals.totalbytesrecv != null ? Number(totals.totalbytesrecv) : 0;
        const sent = totals.totalbytessent != null ? Number(totals.totalbytessent) : 0;
        let rawTime = totals.timemillis != null ? Number(totals.timemillis) : 0;
        // Some nodes return timemillis in microseconds; if value is huge, treat as microseconds
        const uptimeSec = rawTime >= 1e12 ? rawTime / 1e6 : (rawTime > 0 ? rawTime / 1000 : 0);
        const recvRate = uptimeSec > 0 ? recv / uptimeSec : 0;
        const sentRate = uptimeSec > 0 ? sent / uptimeSec : 0;
        // Cap absurd uptime display (e.g. > 365 days show as-is; if calculation would show 10000+ days, treat as unknown)
        const maxReasonableDays = 365 * 10;
        const uptimeValid = uptimeSec > 0 && uptimeSec < maxReasonableDays * 86400;

        res.render('network-traffic', {
            title: 'Network Traffic',
            netTotals: totals,
            networkInfo: networkInfo || {},
            recvRateFormatted: formatRate(recvRate),
            sentRateFormatted: formatRate(sentRate),
            uptimeSec,
            uptimeValid,
            mempoolStats: mempoolStats || { count: 0, vsize: 0, total_fee: 0 },
            page: 'network-traffic'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load network traffic', error: error.message, page: 'error' });
    }
});

// Difficulty History page
app.get('/difficulty', async (req, res) => {
    try {
        const tipHeight = await apiCall('/blocks/tip/height');
        const currentHeight = typeof tipHeight === 'number' ? tipHeight : parseInt(tipHeight || '0', 10);
        
        // Fetch blocks for difficulty history (last 100 blocks, sample every 10th)
        const difficultyHistory = [];
        const sampleInterval = 10;
        const maxBlocks = 100;
        
        for (let i = 0; i < maxBlocks; i += sampleInterval) {
            const height = currentHeight - i;
            if (height < 0) break;
            
            try {
                const blockHash = await apiCall(`/block-height/${height}`);
                const block = await apiCall(`/block/${blockHash}`);
                if (block && block.difficulty) {
                    difficultyHistory.push({
                        height: block.height,
                        timestamp: block.timestamp,
                        difficulty: block.difficulty,
                        date: new Date(block.timestamp * 1000).toLocaleDateString()
                    });
                }
            } catch (e) {
                // Skip if block not found
                continue;
            }
        }
        
        difficultyHistory.reverse(); // Oldest first
        
        res.render('difficulty', {
            title: 'Difficulty History',
            difficultyHistory,
            tipHeight: currentHeight,
            page: 'difficulty'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load difficulty history', error: error.message, page: 'error' });
    }
});

// API documentation page
app.get('/api-docs', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}/api`;
    res.render('api', {
        title: 'API',
        baseUrl,
        page: 'api'
    });
});

// Glossary / FAQ page (static content)
app.get('/glossary', (req, res) => {
    res.render('glossary', {
        title: 'Glossary & FAQ',
        page: 'glossary'
    });
});

// Holders page
app.get('/holders', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const holdersData = await indexerApiCall(`/holders?page=${page}&limit=${limit}`);

        res.render('holders', {
            title: 'Holders',
            holders: holdersData.holders || [],
            currentPage: holdersData.page || page,
            limit: holdersData.limit || limit,
            total: holdersData.total || 0,
            totalPages: holdersData.total_pages || 1,
            page: 'holders'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load holders', error: error.message, page: 'error' });
    }
});

// Statistics page
app.get('/statistics', async (req, res) => {
    try {
        const [blocks, tipHeight] = await Promise.all([
            apiCall('/blocks'),
            apiCall('/blocks/tip/height')
        ]);

        // Calculate stats
        const blockTimeSec = blocks.length > 1
            ? Math.round((blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / (blocks.length - 1))
            : config.blockTime;
        const avgBlockTime = blockTimeSec > 0 ? blockTimeSec : config.blockTime;
        const latestDifficulty = blocks[0]?.difficulty || 0;

        // Hashrate: prefer RPC networkhashps (accurate), fallback to block-based estimate
        const hashrate = await getHashrate(blocks);

        // Get daily tx counts (simplified - from recent blocks)
        const dailyStats = blocks.map(b => ({
            date: new Date(b.timestamp * 1000).toLocaleDateString(),
            txCount: b.tx_count,
            size: b.size
        }));

        res.render('statistics', {
            title: 'Statistics',
            tipHeight,
            avgBlockTime,
            hashrate,
            difficulty: latestDifficulty,
            dailyStats,
            page: 'statistics'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load statistics', error: error.message, page: 'error' });
    }
});

// Emission / halving page
app.get('/emission', async (req, res) => {
    try {
        const [tipHeight, supplyData] = await Promise.all([
            apiCall('/blocks/tip/height'),
            apiCall('/blockchain/getsupply').catch(() => null),
        ]);

        const HALVING_INTERVAL = 210000; // from wojakcore chainparams
        const INITIAL_SUBSIDY = 100; // WOJAK per block
        const blockTimeSec = config.blockTime || 120;

        const maxEpochs = 15;
        let reward = INITIAL_SUBSIDY;
        let cumulative = 0;
        const epochs = [];

        for (let epoch = 0; epoch < maxEpochs && reward > 0; epoch++) {
            const startHeight = epoch * HALVING_INTERVAL;
            const endHeight = (epoch + 1) * HALVING_INTERVAL - 1;
            const blocksInEpoch = HALVING_INTERVAL;
            const coinsThisEpoch = reward * blocksInEpoch;
            cumulative += coinsThisEpoch;

            epochs.push({
                epoch,
                reward,
                startHeight,
                endHeight,
                blocksInEpoch,
                coinsThisEpoch,
                cumulativeSupply: cumulative,
            });

            reward = reward / 2;
        }

        const currentHeight = typeof tipHeight === 'number' ? tipHeight : parseInt(tipHeight || '0', 10);
        const currentEpochIndex = Math.floor(currentHeight / HALVING_INTERVAL);
        const currentEpoch = epochs[Math.min(currentEpochIndex, epochs.length - 1)];
        const currentReward = currentEpoch ? currentEpoch.reward : 0;

        const nextHalvingHeight = (currentEpochIndex + 1) * HALVING_INTERVAL;
        const blocksToHalving = nextHalvingHeight > currentHeight ? (nextHalvingHeight - currentHeight) : 0;
        const secondsToHalving = blocksToHalving * blockTimeSec;
        const estimatedHalvingDate = blocksToHalving > 0
            ? new Date(Date.now() + secondsToHalving * 1000).toLocaleString()
            : null;

        // WojakCoin MAX_MONEY (from wojakcore src/amount.h): 44,210,526 * COIN
        const theoreticalMaxSupply = 44210526;
        const actualSupply = supplyData && (supplyData.total_amount_float || supplyData.total_amount);

        res.render('emission', {
            title: 'Emission',
            currentHeight,
            currentReward,
            nextHalvingHeight,
            blocksToHalving,
            estimatedHalvingDate,
            theoreticalMaxSupply,
            actualSupply,
            epochs,
            halvingInterval: HALVING_INTERVAL,
            page: 'emission',
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load emission data', error: error.message, page: 'error' });
    }
});

// Coin flow: money moving from address to address
const COIN_FLOW_PAGE_SIZE = 30;
const COIN_FLOW_BATCH = 8;

app.get('/coin-flow', async (req, res) => {
    try {
        const page = Math.max(0, parseInt(req.query.page) || 0);
        const blocks = await apiCall('/blocks');
        const txids = [];
        const minTxids = (page + 1) * COIN_FLOW_PAGE_SIZE;
        for (const block of blocks.slice(0, 20)) {
            try {
                const txs = await apiCall(`/block/${block.id}/txs/0`);
                const ids = Array.isArray(txs) ? txs.map(t => t.txid || t) : [];
                ids.forEach(id => txids.push({ txid: id, blockHeight: block.height, blockTime: block.timestamp }));
                if (txids.length >= minTxids) break;
            } catch (e) {
                continue;
            }
        }
        const start = page * COIN_FLOW_PAGE_SIZE;
        const pageTxids = txids.slice(start, start + COIN_FLOW_PAGE_SIZE);
        const flows = [];
        for (let i = 0; i < pageTxids.length; i += COIN_FLOW_BATCH) {
            const batch = pageTxids.slice(i, i + COIN_FLOW_BATCH);
            const fullTxs = await Promise.all(
                batch.map(({ txid }) => apiCall(`/tx/${txid}`).catch(() => null))
            );
            fullTxs.forEach((tx, idx) => {
                if (!tx) return;
                const meta = pageTxids[i + idx];
                const from = [];
                const to = [];
                (tx.vin || []).forEach(vin => {
                    if (vin.is_coinbase) {
                        from.push({ address: 'Coinbase (new coins)', value: 0, coinbase: true });
                    } else if (vin.prevout) {
                        const addr = vin.prevout.scriptpubkey_address || null;
                        const val = vin.prevout.value != null ? vin.prevout.value : 0;
                        if (addr) from.push({ address: addr, value: val, coinbase: false });
                    }
                });
                (tx.vout || []).forEach(vout => {
                    const addr = vout.scriptpubkey_address || (vout.scriptpubkey && vout.scriptpubkey.address) || null;
                    const val = vout.value != null ? vout.value : 0;
                    if (addr) to.push({ address: addr, value: val });
                });
                flows.push({
                    txid: tx.txid,
                    blockHeight: meta.blockHeight,
                    blockTime: meta.blockTime,
                    from,
                    to,
                    fee: tx.fee != null ? tx.fee : null,
                    status: tx.status
                });
            });
        }
        const totalPages = Math.ceil(txids.length / COIN_FLOW_PAGE_SIZE) || 1;
        res.render('coin-flow', {
            title: 'Coin Flow',
            flows,
            total: txids.length,
            currentPage: page,
            totalPages,
            pageSize: COIN_FLOW_PAGE_SIZE,
            page: 'coin-flow'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load coin flow', error: error.message, page: 'error' });
    }
});

// Redirect old supply-flow URL to coin-flow (address-to-address flow)
app.get('/supply-flow', (req, res) => res.redirect(301, '/coin-flow'));

// Legacy supply-over-time page (kept for possible future use; not linked in nav)
app.get('/supply-flow-chart', async (req, res) => {
    try {
        const [tipHeight, supplyData, indexerSupply] = await Promise.all([
            apiCall('/blocks/tip/height'),
            apiCall('/blockchain/getsupply').catch(() => ({ total_amount_float: 0 })),
            indexerApiCall('/block/circulating-supply').catch(() => null)
        ]);

        // Get circulating supply (prefer indexer, fallback to electrs)
        const circulatingSupply = indexerSupply != null ? indexerSupply.circulatingSupply : (supplyData.total_amount_float || 0);

        // Calculate some historical points (simplified - could be enhanced)
        const currentReward = config.blockTime ? config.blockTime / 60 : 0; // blocks per hour
        const dailyBlocks = 24 * 60 / (config.blockTime || 120); // blocks per day
        const dailySupplyIncrease = dailyBlocks * 50; // 50 WJK per block (current reward)

        // Generate projection data (next 365 days)
        const projectionDays = 365;
        const projectionData = [];
        for (let i = 0; i < projectionDays; i += 30) { // Monthly points
            const supply = circulatingSupply + (i * dailySupplyIncrease);
            projectionData.push({
                days: i,
                supply: supply,
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
        }

        res.render('supply-flow', {
            title: 'Supply Flow',
            tipHeight,
            circulatingSupply,
            dailySupplyIncrease,
            projectionData,
            page: 'supply-flow'
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load supply flow data', error: error.message, page: 'error' });
    }
});

// Supply dashboard page
app.get('/supply', async (req, res) => {
    try {
        const [tipHeight, supplyData, circData] = await Promise.all([
            apiCall('/blocks/tip/height'),
            apiCall('/blockchain/getsupply').catch(() => null),
            indexerApiCall('/block/circulating-supply').catch(() => null),
        ]);

        const HALVING_INTERVAL = 210000;
        const INITIAL_SUBSIDY = 100;
        const blockTimeSec = config.blockTime || 120;
        const MAX_SUPPLY = 44210526; // from wojakcore MAX_MONEY/COIN

        const currentHeight = typeof tipHeight === 'number' ? tipHeight : parseInt(tipHeight || '0', 10);
        const totalSupply = supplyData && (supplyData.total_amount_float || supplyData.total_amount) || null;
        // Prefer on-chain total for circulating when available so they match
        const circulatingSupply = totalSupply != null
            ? totalSupply
            : (circData && circData.circulatingSupply) || null;

        const epochIndex = currentHeight > 0 ? Math.floor(currentHeight / HALVING_INTERVAL) : 0;
        const currentReward = INITIAL_SUBSIDY / Math.pow(2, epochIndex);
        const blocksPerDay = 86400 / blockTimeSec;
        const dailyIssuance = currentReward * blocksPerDay;
        const yearlyIssuance = dailyIssuance * 365;

        const mintedPct = totalSupply ? (totalSupply / MAX_SUPPLY) * 100 : null;
        const circPct = circulatingSupply ? (circulatingSupply / MAX_SUPPLY) * 100 : null;

        res.render('supply', {
            title: 'Supply',
            currentHeight,
            totalSupply,
            circulatingSupply,
            maxSupply: MAX_SUPPLY,
            mintedPct,
            circPct,
            currentReward,
            dailyIssuance,
            yearlyIssuance,
            blocksPerDay,
            page: 'supply',
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load supply dashboard', error: error.message, page: 'error' });
    }
});

// Mining stats page
app.get('/mining', async (req, res) => {
    try {
        const [blocks, miningInfo] = await Promise.all([
            apiCall('/blocks'),
            rpcCall('getmininginfo')
        ]);
        const recentBlocks = (blocks || []).slice(0, 15);

        const miningBlocks = [];
        for (const block of recentBlocks) {
            try {
                const txs = await apiCall(`/block/${block.id}/txs/0`);
                const cbTx = Array.isArray(txs) && txs.length > 0 ? txs[0] : null;
                if (!cbTx || !cbTx.vout || !cbTx.vout.length) continue;

                const minerAddress = cbTx.vout[0].scriptpubkey_address || 'Unknown';
                const rewardSats = (cbTx.vout || []).reduce((sum, v) => sum + (v.value || 0), 0);
                const reward = rewardSats / 1e8;

                miningBlocks.push({
                    height: block.height,
                    hash: block.id,
                    timestamp: block.timestamp,
                    txCount: block.tx_count,
                    difficulty: block.difficulty,
                    minerAddress,
                    reward,
                });
            } catch (e) {
                continue;
            }
        }

        const minerMap = {};
        miningBlocks.forEach((b) => {
            const key = b.minerAddress || 'Unknown';
            if (!minerMap[key]) {
                minerMap[key] = { minerAddress: key, blocks: 0, totalReward: 0 };
            }
            minerMap[key].blocks += 1;
            minerMap[key].totalReward += b.reward || 0;
        });

        const miners = Object.values(minerMap).sort((a, b) => b.blocks - a.blocks);
        const totalBlocks = miningBlocks.length || 1;
        const hashrate = miningInfo?.networkhashps != null ? miningInfo.networkhashps : 0;
        const difficulty = miningInfo?.difficulty ?? (recentBlocks[0]?.difficulty) ?? 0;

        res.render('mining', {
            title: 'Mining Stats',
            blocks: miningBlocks,
            miners,
            totalBlocks,
            hashrate,
            difficulty,
            page: 'mining',
        });
    } catch (error) {
        res.render('error', { title: 'Error', message: 'Failed to load mining stats', error: error.message, page: 'error' });
    }
});

// Search handler
app.get('/search', async (req, res) => {
    const query = req.query.q?.trim();

    if (!query) {
        return res.redirect('/');
    }

    // Check if it's a block height (number only)
    if (/^\d+$/.test(query)) {
        try {
            const blockHash = await apiCall(`/block-height/${query}`);
            return res.redirect(`/block/${blockHash}`);
        } catch (e) {
            // Not a valid block height
        }
    }

    // Check if it's a block hash (64 hex chars)
    if (/^[a-fA-F0-9]{64}$/.test(query)) {
        try {
            await apiCall(`/block/${query}`);
            return res.redirect(`/block/${query}`);
        } catch (e) {
            // Try as transaction
            try {
                await apiCall(`/tx/${query}`);
                return res.redirect(`/tx/${query}`);
            } catch (e2) {
                // Not found
            }
        }
    }

    // Try as address
    try {
        await apiCall(`/address/${query}`);
        return res.redirect(`/address/${query}`);
    } catch (e) {
        // Not found
    }

    res.render('error', {
        title: 'Not Found',
        message: 'No results found',
        error: `Could not find block, transaction, or address matching: ${query}`,
        page: 'search'
    });
});

// ============ API PROXY ============

app.get('/api/*', async (req, res) => {
    try {
        const endpoint = req.path.replace('/api', '');
        const data = await apiCall(endpoint);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Internal Server Error',
        error: err.message,
        page: 'error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 ${config.explorerName} running at http://localhost:${PORT}`);
    console.log(`📡 Connected to electrs at ${ELECTRS_API}`);
});
