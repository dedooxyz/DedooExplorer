// Wojak Explorer - Frontend JavaScript

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Copied to clipboard!');
    });
}

// Toast notification
function showToast(message, duration = 2000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #F5A623, #C88A1D);
        color: #000;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 20px rgba(245, 166, 35, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add toast animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
`;
document.head.appendChild(style);

// Format large numbers
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format hashrate
function formatHashrate(hashrate) {
    if (hashrate >= 1e18) return (hashrate / 1e18).toFixed(2) + ' EH/s';
    if (hashrate >= 1e15) return (hashrate / 1e15).toFixed(2) + ' PH/s';
    if (hashrate >= 1e12) return (hashrate / 1e12).toFixed(2) + ' TH/s';
    if (hashrate >= 1e9) return (hashrate / 1e9).toFixed(2) + ' GH/s';
    if (hashrate >= 1e6) return (hashrate / 1e6).toFixed(2) + ' MH/s';
    if (hashrate >= 1e3) return (hashrate / 1e3).toFixed(2) + ' KH/s';
    return hashrate.toFixed(2) + ' H/s';
}

// Format difficulty
function formatDifficulty(diff) {
    if (diff >= 1e12) return (diff / 1e12).toFixed(2) + 'T';
    if (diff >= 1e9) return (diff / 1e9).toFixed(2) + 'B';
    if (diff >= 1e6) return (diff / 1e6).toFixed(2) + 'M';
    if (diff >= 1e3) return (diff / 1e3).toFixed(2) + 'K';
    return diff.toFixed(2);
}

// Auto-refresh dashboard data every 30 seconds
let refreshInterval;

function startAutoRefresh() {
    const isDashboard = window.location.pathname === '/';
    if (isDashboard) {
        refreshInterval = setInterval(() => {
            // Soft refresh - just update stats via API
            fetch('/api/blocks/tip/height')
                .then(res => res.text())
                .then(height => {
                    const heightElement = document.querySelector('.stat-value');
                    if (heightElement) {
                        heightElement.textContent = formatNumber(parseInt(height));
                    }
                })
                .catch(err => console.log('Auto-refresh failed:', err));
        }, 30000);
    }
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Search form enhancement
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !searchInput.value.trim()) {
                e.preventDefault();
            }
        });

        // Add keyboard shortcut (/ to focus search)
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        });
    }

    // Start auto-refresh on dashboard
    startAutoRefresh();

    // Add hover effect for clickable rows
    const clickableRows = document.querySelectorAll('.clickable-row');
    clickableRows.forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.cursor = 'pointer';
        });
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', stopAutoRefresh);

// Expandable hash functionality
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('hash-value') && !e.target.closest('a')) {
        const fullHash = e.target.getAttribute('title');
        if (fullHash && e.target.textContent.includes('...')) {
            e.target.innerHTML = fullHash;
        }
    }
});

// ============ THEME TOGGLE ============

// Get current theme
function getCurrentTheme() {
    return localStorage.getItem('theme') || 'dark';
}

// Update theme icon based on current theme
function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        const theme = getCurrentTheme();
        if (theme === 'light') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// Toggle between dark and light theme
function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Update localStorage
    localStorage.setItem('theme', newTheme);

    // Update data attribute on html element
    document.documentElement.setAttribute('data-theme', newTheme);

    // Update icon
    updateThemeIcon();

    // Show toast
    showToast(`Switched to ${newTheme} mode`);
}

// Initialize theme icon on page load
document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();
});

console.log('🚀 DedooExplorer loaded');
