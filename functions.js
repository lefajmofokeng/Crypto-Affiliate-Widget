(function() {
            // Fetch top 30 to ensure we have enough data for "Top Movers" without extra API calls
            const API_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h';
            const UPDATE_INTERVAL_MS = 60000;
            const TRACK_ID = 'icaw-card-track';
            const VIEWPORT_ID = 'icaw-carousel-viewport';
            const DOTS_ID = 'icaw-pagination-dots';
            const AFFILIATE_LINK_BASE = "https://crypto.com/app/YOUR_CODE_HERE";

            let coinDataCache = [];
            let currentMode = 'trending'; // 'trending' or 'movers'
            let autoUpdateTimer;

            async function fetchCryptoData() {
                try {
                    const response = await fetch(API_URL);
                    if (!response.ok) throw new Error('Network error');
                    coinDataCache = await response.json();
                    renderByMode();
                } catch (error) {
                    console.error('Widget Error:', error);
                    // Only show error if we have no cache
                    if(coinDataCache.length === 0) {
                        document.getElementById(TRACK_ID).innerHTML = '<div class="icaw-loading-placeholder">Data unavailable. Try connecting to the internet.</div>';
                    }
                }
            }

            function renderByMode() {
                if (coinDataCache.length === 0) return;

                let displayData = [...coinDataCache];

                if (currentMode === 'movers') {
                    // Sort by percentage change (highest positive first)
                    displayData.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
                } else {
                    // Default API order is Market Cap (Trending)
                    displayData.sort((a, b) => b.market_cap - a.market_cap);
                }

                // Slice top 10 for display
                renderCards(displayData.slice(0, 10));
            }

            function formatCurrency(amount) {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: amount < 1 ? 4 : 2,
                    maximumFractionDigits: amount < 1 ? 6 : 2,
                }).format(amount).replace('$', '');
            }

            function generateSparklineSVG(prices, isNegative) {
                if (!prices || prices.length === 0) return '';
                // Internal coordinate system
                const width = 300; 
                const height = 100;
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const range = max - min || 0.0001;
                const stepX = width / (prices.length - 1);

                // Build Line Path
                let pathD = `M 0 ${height - ((prices[0] - min) / range * height)}`;
                for (let i = 1; i < prices.length; i++) {
                    const x = i * stepX;
                    const y = height - ((prices[i] - min) / range * height);
                    pathD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
                }

                const color = isNegative ? '#FF3B30' : '#34C759';
                
                // Build Fill Path (extends to bottom)
                const fillPathD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

                return `
                    <svg class="icaw-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad-${isNegative ? 'down' : 'up'}" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" style="stop-color:${color};stop-opacity:0.25" />
                                <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
                            </linearGradient>
                        </defs>
                        <path d="${fillPathD}" fill="url(#grad-${isNegative ? 'down' : 'up'})" stroke="none" />
                        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                `;
            }

            function renderCards(coins) {
                const track = document.getElementById(TRACK_ID);
                track.innerHTML = ''; 

                coins.forEach(coin => {
                    const priceChange = coin.price_change_percentage_24h || 0;
                    const isNegative = priceChange < 0;
                    const changeClass = isNegative ? 'icaw-down' : 'icaw-up';
                    const changeSign = isNegative ? '' : '+';
                    const sparklineSVG = generateSparklineSVG(coin.sparkline_in_7d.price, isNegative);
                    const coinAffiliateLink = `${AFFILIATE_LINK_BASE}?coin_symbol=${coin.symbol.toUpperCase()}`;

                    const cardHtml = `
                        <div class="icaw-card">
                            <div class="icaw-card-top">
                                <img src="${coin.image}" alt="${coin.name}" class="icaw-coin-icon">
                                <div class="icaw-coin-names">
                                    <span class="icaw-coin-name">${coin.name}</span>
                                    <span class="icaw-coin-symbol">${coin.symbol}</span>
                                </div>
                            </div>
                            <div class="icaw-card-graph-container">
                                ${sparklineSVG}
                            </div>
                            <div class="icaw-card-bottom">
                                <div class="icaw-price-info">
                                    <span class="icaw-price">$${formatCurrency(coin.current_price)} <span class="icaw-currency">USD</span></span>
                                    <span class="icaw-change ${changeClass}">${changeSign}${priceChange.toFixed(2)}% 24H</span>
                                </div>
                                <a href="${coinAffiliateLink}" target="_blank" rel="nofollow noopener" class="icaw-buy-btn">Buy</a>
                            </div>
                        </div>
                    `;
                    track.insertAdjacentHTML('beforeend', cardHtml);
                });
            }

            function updatePaginationDots() {
                const viewport = document.getElementById(VIEWPORT_ID);
                const dots = document.querySelectorAll('.icaw-dot');
                
                // Calculate scroll progress (0 to 1)
                const maxScroll = viewport.scrollWidth - viewport.clientWidth;
                if (maxScroll <= 0) return; // No scroll needed

                const scrollRatio = viewport.scrollLeft / maxScroll;
                
                // Map ratio to 3 dots (0-0.33, 0.33-0.66, 0.66-1.0)
                let activeIndex = 0;
                if (scrollRatio > 0.60) activeIndex = 2;
                else if (scrollRatio > 0.25) activeIndex = 1;

                dots.forEach((dot, index) => {
                    if (index === activeIndex) dot.classList.add('icaw-active');
                    else dot.classList.remove('icaw-active');
                });
            }

            function setupInteractions() {
                const viewport = document.getElementById(VIEWPORT_ID);
                const leftBtn = document.getElementById('icaw-arrow-left');
                const rightBtn = document.getElementById('icaw-arrow-right');
                const tabTrending = document.getElementById('icaw-tab-trending');
                const tabMovers = document.getElementById('icaw-tab-movers');

                // Tabs
                tabTrending.addEventListener('click', () => {
                    if(currentMode === 'trending') return;
                    currentMode = 'trending';
                    tabTrending.classList.add('icaw-active');
                    tabMovers.classList.remove('icaw-active');
                    renderByMode();
                    viewport.scrollLeft = 0; // Reset scroll
                });

                tabMovers.addEventListener('click', () => {
                    if(currentMode === 'movers') return;
                    currentMode = 'movers';
                    tabMovers.classList.add('icaw-active');
                    tabTrending.classList.remove('icaw-active');
                    renderByMode();
                    viewport.scrollLeft = 0; // Reset scroll
                });
                
                // Scroll Arrows
                const scrollAmount = 350; 
                leftBtn.addEventListener('click', () => viewport.scrollBy({ left: -scrollAmount, behavior: 'smooth' }));
                rightBtn.addEventListener('click', () => viewport.scrollBy({ left: scrollAmount, behavior: 'smooth' }));

                // Scroll Listener for Pagination
                viewport.addEventListener('scroll', () => {
                   window.requestAnimationFrame(updatePaginationDots);
                });

                // Drag to scroll (Desktop)
                let isDown = false;
                let startX;
                let scrollLeft;

                viewport.addEventListener('mousedown', (e) => {
                    isDown = true;
                    viewport.style.cursor = 'grabbing';
                    startX = e.pageX - viewport.offsetLeft;
                    scrollLeft = viewport.scrollLeft;
                    viewport.style.scrollSnapType = 'none'; 
                });

                viewport.addEventListener('mouseleave', () => {
                    isDown = false;
                    viewport.style.cursor = 'grab';
                    viewport.style.scrollSnapType = 'x mandatory';
                });

                viewport.addEventListener('mouseup', () => {
                    isDown = false;
                    viewport.style.cursor = 'grab';
                    viewport.style.scrollSnapType = 'x mandatory';
                });

                viewport.addEventListener('mousemove', (e) => {
                    if (!isDown) return;
                    e.preventDefault();
                    const x = e.pageX - viewport.offsetLeft;
                    const walk = (x - startX) * 2; 
                    viewport.scrollLeft = scrollLeft - walk;
                });
            }
            
            function initWidget() {
                fetchCryptoData();
                setupInteractions();
                if (autoUpdateTimer) clearInterval(autoUpdateTimer);
                autoUpdateTimer = setInterval(fetchCryptoData, UPDATE_INTERVAL_MS);
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initWidget);
            } else {
                initWidget();
            }
        })();