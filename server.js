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

// Make helpers available to all views
app.locals.formatHash = formatHash;
app.locals.formatNumber = formatNumber;
app.locals.formatBytes = formatBytes;
app.locals.formatTimeAgo = formatTimeAgo;
app.locals.formatDate = formatDate;
app.locals.formatHashrate = formatHashrate;
app.locals.formatDifficulty = formatDifficulty;

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

// ============ PAGES ============

// Dashboard
app.get('/', async (req, res) => {
    try {
        const [blocks, tipHeight, mempool, supplyData] = await Promise.all([
            apiCall('/blocks'),
            apiCall('/blocks/tip/height'),
            apiCall('/mempool/recent').catch(() => []),
            apiCall('/blockchain/getsupply').catch(() => ({ total_amount_float: 0 }))
        ]);

        // Calculate stats from recent blocks
        const avgBlockTime = blocks.length > 1
            ? Math.round((blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / (blocks.length - 1))
            : 120;

        // Estimate hashrate from difficulty (rough estimate)
        const latestDifficulty = blocks[0]?.difficulty || 0;
        const hashrate = (latestDifficulty * Math.pow(2, 32)) / avgBlockTime;

        res.render('index', {
            title: 'Dashboard',
            blocks: blocks.slice(0, 15),
            tipHeight,
            mempoolCount: mempool.length,
            difficulty: latestDifficulty,
            avgBlockTime,
            hashrate,
            supply: supplyData.total_amount_float || 0,
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

// Transaction detail
app.get('/tx/:txid', async (req, res) => {
    try {
        const { txid } = req.params;
        const tx = await apiCall(`/tx/${txid}`);

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

        res.render('transaction', {
            title: `Transaction ${formatHash(txid)}`,
            tx,
            totalInput,
            totalOutput,
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

// Statistics page
app.get('/statistics', async (req, res) => {
    try {
        const [blocks, tipHeight] = await Promise.all([
            apiCall('/blocks'),
            apiCall('/blocks/tip/height')
        ]);

        // Calculate stats
        const avgBlockTime = blocks.length > 1
            ? Math.round((blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / (blocks.length - 1))
            : 120;

        const latestDifficulty = blocks[0]?.difficulty || 0;
        const hashrate = (latestDifficulty * Math.pow(2, 32)) / avgBlockTime;

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
