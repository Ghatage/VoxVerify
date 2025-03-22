// Try to import the 3D visualizer, but allow the app to work even if the import fails
let AudioVisualizer;
try {
  // Dynamic import to handle potential module loading failures
  import('./js/visualizer.js').then(module => {
    AudioVisualizer = module.AudioVisualizer;
    console.log('Successfully imported AudioVisualizer module');
  }).catch(error => {
    console.error('Failed to import AudioVisualizer module:', error);
    AudioVisualizer = null;
  });
} catch (error) {
  console.error('Error in import statement:', error);
  AudioVisualizer = null;
}

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const validateBtn = document.getElementById('validateBtn');
    const circleText = document.getElementById('circleText');
    const statusDisplay = document.getElementById('statusDisplay');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const visualizerContainer = document.getElementById('visualizerContainer');
    
    // Create a log container with a collapse/expand feature
    const logWrapper = document.createElement('div');
    logWrapper.style.margin = '0';
    logWrapper.style.width = '100%';
    logWrapper.style.border = '1px solid #222';
    logWrapper.style.borderRadius = '4px 4px 0 0';
    logWrapper.style.overflow = 'hidden';
    logWrapper.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
    logWrapper.style.position = 'fixed'; // Fixed position
    logWrapper.style.bottom = '0'; // At the bottom of the screen
    logWrapper.style.left = '0'; // Full width
    logWrapper.style.right = '0'; // Full width
    logWrapper.style.zIndex = '1000'; // Above other elements
    
    // Create log header with toggle button
    const logHeader = document.createElement('div');
    logHeader.style.backgroundColor = '#111';
    logHeader.style.padding = '8px 12px';
    logHeader.style.display = 'flex';
    logHeader.style.justifyContent = 'space-between';
    logHeader.style.alignItems = 'center';
    logHeader.style.cursor = 'pointer';
    logHeader.style.borderBottom = '1px solid #222';
    logHeader.style.color = '#00aa00';
    logHeader.style.fontWeight = 'bold';
    logHeader.style.boxShadow = '0 -2px 5px rgba(0, 0, 0, 0.3)';
    
    const logTitle = document.createElement('span');
    logTitle.textContent = 'Debug Logs';
    logTitle.style.fontWeight = 'bold';
    
    const logToggle = document.createElement('span');
    logToggle.textContent = '+'; // Using plus symbol when collapsed
    logToggle.style.transition = 'transform 0.3s';
    logToggle.style.fontFamily = 'monospace';
    logToggle.style.fontSize = '18px';
    logToggle.style.width = '24px';
    logToggle.style.height = '24px';
    logToggle.style.display = 'flex';
    logToggle.style.justifyContent = 'center';
    logToggle.style.alignItems = 'center';
    logToggle.style.border = '1px solid #333';
    logToggle.style.borderRadius = '4px';
    
    logHeader.appendChild(logTitle);
    logHeader.appendChild(logToggle);
    
    // Create log container
    const logContainer = document.createElement('div');
    logContainer.style.padding = '0 10px';
    logContainer.style.height = '0';
    logContainer.style.maxHeight = '0';
    logContainer.style.overflow = 'auto'; // Always show scrollbar when needed
    logContainer.style.overflowX = 'hidden'; // Hide horizontal scrollbar
    logContainer.style.backgroundColor = '#111';
    logContainer.style.fontFamily = 'monospace';
    logContainer.style.fontSize = '12px';
    logContainer.style.transition = 'max-height 0.3s ease-out';
    logContainer.style.color = '#00aa00';
    
    // Add components to wrapper
    logWrapper.appendChild(logHeader);
    logWrapper.appendChild(logContainer);
    document.body.appendChild(logWrapper);
    
    // Add padding to body to ensure content isn't hidden behind fixed log panel
    const paddingBottom = document.createElement('div');
    paddingBottom.style.height = '10px'; // Smaller padding since logs are collapsed
    paddingBottom.style.width = '100%';
    document.body.appendChild(paddingBottom);
    
    // Toggle logs visibility
    let logsVisible = false; // Start with logs hidden
    logHeader.addEventListener('click', () => {
        logsVisible = !logsVisible;
        if (logsVisible) {
            logContainer.style.maxHeight = '200px';
            logContainer.style.height = 'auto';
            logContainer.style.padding = '10px';
            logToggle.textContent = '−'; // Minus symbol when expanded
            logToggle.style.transform = 'rotate(0deg)';
            paddingBottom.style.height = '50px'; // Restore padding
        } else {
            logContainer.style.maxHeight = '0';
            logContainer.style.height = '0';
            logContainer.style.padding = '0 10px';
            logToggle.textContent = '+'; // Plus symbol when collapsed
            logToggle.style.transform = 'rotate(0deg)';
            paddingBottom.style.height = '10px'; // Reduce padding when collapsed
        }
    });
    
    // Log function that writes to the page and the console
    function log(message, type = 'info') {
        const entry = document.createElement('div');
        entry.style.padding = '4px 0';
        entry.style.borderBottom = '1px solid #222';
        entry.style.lineHeight = '1.4';
        entry.style.wordBreak = 'break-word';
        
        const timestamp = document.createElement('span');
        timestamp.textContent = `${new Date().toLocaleTimeString()}: `;
        timestamp.style.opacity = '0.8';
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        entry.appendChild(timestamp);
        entry.appendChild(messageSpan);
        
        if (type === 'error') {
            entry.style.color = '#ff5555'; // Red for errors
            console.error(message);
        } else if (type === 'warning') {
            entry.style.color = '#ffaa00'; // Orange for warnings
            console.warn(message);
        } else {
            entry.style.color = '#00aa00'; // Green for standard logs
            console.log(message);
        }
        
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll to bottom
    }
    
    // Audio context and recorder variables
    let audioContext = null;
    let recorder = null;
    let ggwave = null;
    let ggwaveInstance = null;
    let audioChunks = [];
    let isRecording = false;
    let audioInitialized = false;
    let analyser = null;
    let visualizerActive = false;
    let audioVisualizer = null;
    let using3DVisualizer = false;
    let animationFrameId = null;
    
    // Helper function to convert array types (from gibberlink)
    function convertTypedArray(src, type) {
        const buffer = new ArrayBuffer(src.byteLength);
        new src.constructor(buffer).set(src);
        return new type(buffer);
    }
    
    // Check if we're on iOS - need special handling
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    log(`Detected platform: ${isIOS ? 'iOS' : 'non-iOS'}`);
    
    // Check GGWave API available and log to main logs
    async function checkGGWaveAPI() {
        log('Checking GGWave API...', 'info');
        
        // Check for ggwave_factory (gibberlink approach)
        if (typeof window.ggwave_factory === 'function') {
            log('Found window.ggwave_factory function', 'info');
            
            try {
                // This is async in the gibberlink code
                const ggwaveObj = await window.ggwave_factory();
                log('ggwave_factory() returned an object successfully', 'info');
                
                // Check what methods the ggwave object has
                if (typeof ggwaveObj.init === 'function') {
                    log('ggwave.init is available', 'info');
                    
                    try {
                        const parameters = ggwaveObj.getDefaultParameters ? 
                                        ggwaveObj.getDefaultParameters() : 
                                        { sampleRateInp: 48000, sampleRateOut: 48000 };
                        log('Parameters created for initialization', 'info');
                        
                        const instance = ggwaveObj.init(parameters);
                        log('ggwave.init(parameters) successful', 'info');
                        
                        if (typeof ggwaveObj.decode === 'function') {
                            log('ggwave.decode is available', 'info');
                        }
                        
                        if (typeof ggwaveObj.encode === 'function') {
                            log('ggwave.encode is available', 'info');
                        }
                        
                        log('SUCCESSFUL initialization pattern!', 'info');
                        
                        // Store for later use
                        window.ggwaveInitialized = {
                            ggwave: ggwaveObj,
                            instance: instance
                        };
                        
                        return true;
                    } catch (e) {
                        log(`Error initializing ggwave: ${e.message}`, 'error');
                    }
                }
            } catch (e) {
                log(`Error calling ggwave_factory(): ${e.message}`, 'error');
            }
        } else {
            log('window.ggwave_factory is not available', 'warning');
        }
        
        // Fall back to checking for direct GGWave (original approach)
        if (typeof GGWave === 'undefined') {
            log('GGWave global is undefined', 'error');
        } else {
            log(`GGWave is a ${typeof GGWave}`, 'info');
        }
        
        return false;
    }
    
    // Initialize GGWave using the gibberlink pattern
    async function initGGWave() {
        // Check API and log details
        await checkGGWaveAPI();
        
        // If already initialized by API check
        if (window.ggwaveInitialized) {
            log('Using GGWave instance initialized during API check');
            ggwave = window.ggwaveInitialized.ggwave;
            ggwaveInstance = window.ggwaveInitialized.instance;
            return true;
        }
        
        try {
            log('Initializing GGWave using factory pattern...');
            
            // Check for ggwave_factory (gibberlink approach)
            if (typeof window.ggwave_factory !== 'function') {
                log('ggwave_factory not found', 'error');
                return false;
            }
            
            // Initialize ggwave following gibberlink pattern
            ggwave = await window.ggwave_factory();
            log('ggwave factory created successfully');
            
            if (!ggwave || typeof ggwave.init !== 'function') {
                log('ggwave.init not found after factory creation', 'error');
                return false;
            }
            
            // Create parameters
            let parameters;
            if (typeof ggwave.getDefaultParameters === 'function') {
                parameters = ggwave.getDefaultParameters();
                log('Using default parameters from ggwave');
            } else {
                parameters = {
                    sampleRateInp: 48000,
                    sampleRateOut: 48000
                };
                log('Using custom parameters');
            }
            
            // Set sample rates
            if (audioContext) {
                parameters.sampleRateInp = audioContext.sampleRate;
                parameters.sampleRateOut = audioContext.sampleRate;
            }
            
            // Initialize ggwave instance
            ggwaveInstance = ggwave.init(parameters);
            log('ggwave instance initialized successfully');
            
            return true;
        } catch (error) {
            log(`Failed to initialize GGWave: ${error.message}`, 'error');
            return false;
        }
    }
    
    // Initialize audio context
    async function initAudio() {
        if (audioInitialized) return true;
        
        try {
            // Create audio context with explicit sample rate
            const options = {
                sampleRate: 48000,
                latencyHint: 'interactive'
            };
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)(options);
            log(`Audio context created with sample rate: ${audioContext.sampleRate}Hz`);
            
            // Create analyser node for visualizations
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            log('Analyser node created for visualizations');
            
            // On mobile, we need to resume the context
            if (audioContext.state === 'suspended') {
                log('Audio context is suspended, attempting to resume...');
                await audioContext.resume();
                log(`Audio context state after resume: ${audioContext.state}`);
            }
            
            // Initialize ggwave
            log('Initializing GGWave...');
            const ggwaveInit = await initGGWave();
            
            if (!ggwaveInit) {
                log('Failed to initialize GGWave', 'error');
                return false;
            }
            
            // Initialize visualizer
            setupVisualizer();
            
            audioInitialized = true;
            statusDisplay.textContent = 'Ready to record';
            return true;
        } catch (error) {
            log(`Error initializing audio context: ${error.message}`, 'error');
            statusDisplay.textContent = 'Error initializing audio system. Please try again.';
            return false;
        }
    }
    
    // Create a simple fallback visualizer with colored circles
    function setupFallbackVisualizer() {
        log('Setting up fallback visualizer...');
        visualizerContainer.innerHTML = '';
        
        // Create a simple circle that will pulse with audio
        const circle = document.createElement('div');
        circle.style.position = 'absolute';
        circle.style.top = '50%';
        circle.style.left = '50%';
        circle.style.transform = 'translate(-50%, -50%)';
        circle.style.width = '200px';
        circle.style.height = '200px';
        circle.style.borderRadius = '50%';
        circle.style.background = 'radial-gradient(circle, #00ff00 0%, #000000 100%)';
        circle.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.5)';
        circle.style.transition = 'transform 0.1s ease-out, box-shadow 0.1s ease-out';
        
        // Add bars around the circle
        for (let i = 0; i < 8; i++) {
            const bar = document.createElement('div');
            bar.style.position = 'absolute';
            bar.style.top = '50%';
            bar.style.left = '50%';
            bar.style.width = '6px';
            bar.style.height = '40px';
            bar.style.backgroundColor = '#00aa00';
            bar.style.borderRadius = '3px';
            bar.style.transform = `rotate(${i * 45}deg) translateY(-150px)`;
            bar.style.transformOrigin = 'bottom center';
            bar.style.transition = 'height 0.1s ease, background-color 0.3s ease';
            bar.dataset.index = i;
            visualizerContainer.appendChild(bar);
        }
        
        visualizerContainer.appendChild(circle);
        log('Fallback visualizer created');
    }
    
    // Setup visualizer - tries 3D first, falls back to simple if needed
    function setupVisualizer() {
        log('Setting up visualizer...');
        try {
            // First try to create the 3D visualizer
            log('Attempting to create 3D visualizer...');
            
            // Check if the AudioVisualizer class was successfully imported
            if (AudioVisualizer) {
                audioVisualizer = new AudioVisualizer(visualizerContainer, audioContext, analyser);
                using3DVisualizer = true;
                log('3D visualizer created successfully');
            } else {
                throw new Error('AudioVisualizer module not available');
            }
        } catch (error) {
            log(`Error creating 3D visualizer: ${error.message}. Using fallback.`, 'warning');
            // If 3D fails, set up the fallback visualizer
            setupFallbackVisualizer();
            using3DVisualizer = false;
        }
    }
    
    // Update the fallback visualizer
    function updateFallbackVisualizer() {
        if (!analyser || !visualizerActive) {
            return;
        }
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average for main circle
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        
        // Update the main circle size based on the audio intensity
        const circle = visualizerContainer.querySelector('div:last-child');
        if (circle) {
            const scale = 1 + (avg / 255) * 0.3; // Scale between 1 and 1.3
            circle.style.transform = `translate(-50%, -50%) scale(${scale})`;
            
            // Also update the glow
            const intensity = Math.floor((avg / 255) * 100);
            circle.style.boxShadow = `0 0 ${30 + intensity}px rgba(0, ${100 + intensity}, 0, 0.5)`;
            
            // Change color based on frequency
            const green = Math.floor(100 + (avg / 255) * 155);
            circle.style.background = `radial-gradient(circle, rgb(0, ${green}, 0) 0%, #000000 100%)`;
        }
        
        // Update the bars
        const bars = visualizerContainer.querySelectorAll('div[data-index]');
        if (bars.length > 0) {
            const segmentSize = Math.floor(bufferLength / bars.length);
            
            bars.forEach((bar, index) => {
                // Get the frequency data for this segment
                const start = index * segmentSize;
                const end = start + segmentSize;
                let segmentAvg = 0;
                
                for (let i = start; i < end; i++) {
                    segmentAvg += dataArray[i];
                }
                segmentAvg /= segmentSize;
                
                // Calculate height (between 40px and 120px)
                const height = 40 + (segmentAvg / 255) * 80;
                bar.style.height = `${height}px`;
                
                // Update position
                bar.style.transform = `rotate(${index * 45}deg) translateY(-${130 + (height - 40) / 2}px)`;
                
                // Update color - green to red based on value
                const red = Math.floor((segmentAvg / 255) * 255);
                const green = Math.floor(170 - (segmentAvg / 255) * 100);
                bar.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
            });
        }
        
        animationFrameId = requestAnimationFrame(updateFallbackVisualizer);
    }
    
    // Update the visualizer with current audio data
    function updateVisualizer() {
        if (!analyser || !visualizerActive) {
            return;
        }
        
        if (using3DVisualizer && audioVisualizer) {
            try {
                // For 3D visualizer
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);
                
                // Calculate average frequency magnitude for a simplified value
                let sum = 0;
                let count = 0;
                
                // Focus on the mid-high frequencies where GGWave typically operates
                const startIndex = Math.floor(bufferLength * 0.2); // Start at 20% of frequency range
                const endIndex = Math.floor(bufferLength * 0.8);   // End at 80% of frequency range
                
                for (let i = startIndex; i < endIndex; i++) {
                    sum += dataArray[i];
                    count++;
                }
                
                const avgFrequency = count > 0 ? sum / count : 0;
                
                // Update the 3D sphere with this value
                audioVisualizer.updateFrequencyData(avgFrequency);
                
                // Request the next animation frame
                requestAnimationFrame(updateVisualizer);
            } catch (error) {
                log(`Error updating 3D visualizer: ${error.message} - Switching to fallback.`, 'error');
                using3DVisualizer = false;
                
                // Clean up visualizer container and set up fallback
                setupFallbackVisualizer();
                
                // Start fallback animation
                updateFallbackVisualizer();
            }
        } else {
            // For fallback visualizer
            updateFallbackVisualizer();
        }
    }
    
    // Start visualizer animation
    function startVisualizer() {
        if (visualizerActive) return;
        
        visualizerActive = true;
        visualizerContainer.classList.add('recording');
        
        if (using3DVisualizer && audioVisualizer) {
            try {
                // Start the 3D visualizer
                audioVisualizer.start();
                
                // Start updating the visualizer
                updateVisualizer();
            } catch (error) {
                log(`Error starting 3D visualizer: ${error.message} - Using fallback.`, 'error');
                using3DVisualizer = false;
                
                // Clean up and set up fallback
                setupFallbackVisualizer();
                
                // Start fallback visualizer
                updateFallbackVisualizer();
            }
        } else {
            // Start fallback visualizer
            updateFallbackVisualizer();
        }
        
        log('Audio visualizer started');
    }
    
    // Stop visualizer animation
    function stopVisualizer() {
        if (!visualizerActive) return;
        
        visualizerActive = false;
        visualizerContainer.classList.remove('recording');
        
        if (using3DVisualizer && audioVisualizer) {
            try {
                // Stop the 3D visualizer
                audioVisualizer.stop();
            } catch (error) {
                log(`Error stopping 3D visualizer: ${error.message}`, 'error');
            }
        }
        
        // Stop animation frame for fallback visualizer
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Reset fallback visualizer if present
        if (!using3DVisualizer) {
            const circle = visualizerContainer.querySelector('div:last-child');
            if (circle) {
                circle.style.transform = 'translate(-50%, -50%) scale(1)';
                circle.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.5)';
            }
            
            const bars = visualizerContainer.querySelectorAll('div[data-index]');
            bars.forEach((bar, index) => {
                bar.style.height = '40px';
                bar.style.transform = `rotate(${index * 45}deg) translateY(-150px)`;
                bar.style.backgroundColor = '#00aa00';
            });
        }
        
        log('Audio visualizer stopped');
    }
    
    // Request microphone permission and start recording
    async function startRecording() {
        // Initialize audio on first user interaction
        if (!audioInitialized) {
            statusDisplay.textContent = 'Initializing audio system...';
            log('Initializing audio system...');
            const initialized = await initAudio();
            if (!initialized) {
                log('Failed to initialize audio', 'error');
                return;
            }
        }
        
        try {
            // Request audio with specific constraints for better compatibility
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            };
            
            log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            log('Microphone access granted');
            
            // Connect stream to analyser for visualization
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Create recorder with specific options
            const options = { mimeType: 'audio/webm' };
            try {
                recorder = new MediaRecorder(stream, options);
                log(`MediaRecorder created with mimeType: ${options.mimeType}`);
            } catch (e) {
                log(`MediaRecorder with options not supported, using default: ${e.message}`, 'warning');
                recorder = new MediaRecorder(stream);
                log(`MediaRecorder created with default settings, mimeType: ${recorder.mimeType}`);
            }
            
            audioChunks = [];
            
            recorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    log(`Received audio chunk: ${event.data.size} bytes`);
                }
            };
            
            recorder.onstop = () => {
                // Stop the visualizer
                stopVisualizer();
                // Process the recording
                processRecording();
                // Stop all tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
            };
            
            // Special handling for iOS
            if (isIOS) {
                // iOS sometimes needs smaller chunks
                recorder.start(500);
                log('Started recording with 500ms chunks (iOS)');
            } else {
                recorder.start(1000); // Collect data in 1-second chunks
                log('Started recording with 1000ms chunks');
            }
            
            isRecording = true;
            
            // Start the visualizer
            startVisualizer();
            
            // Update UI
            validateBtn.textContent = 'Stop Recording';
            validateBtn.classList.add('recording');
            circleText.textContent = '';
            statusDisplay.textContent = 'Listening...';
            
            // Hide agent profile link when starting a new recording
            document.getElementById('agentProfileLink').style.display = 'none';
            
        } catch (error) {
            log(`Error starting recording: ${error.message}`, 'error');
            statusDisplay.textContent = 'Cannot access microphone. Please check permissions.';
        }
    }
    
    // Stop recording
    function stopRecording() {
        if (recorder && isRecording) {
            log('Stopping recording...');
            recorder.stop();
            isRecording = false;
            
            // Update UI
            validateBtn.textContent = 'Validate';
            validateBtn.classList.remove('recording');
            circleText.textContent = '';
            statusDisplay.textContent = 'Processing...';
            loadingIndicator.classList.add('visible');
        }
    }
    
    // Process the recorded audio
    async function processRecording() {
        try {
            log(`Processing ${audioChunks.length} audio chunks...`);
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            log(`Created audio blob of size: ${audioBlob.size} bytes`);
            
            // Decode the audio using ggwave
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            log(`Processing audio buffer of size: ${arrayBuffer.byteLength} bytes`);
            
            try {
                log('Decoding audio data...');
                const audioData = await audioContext.decodeAudioData(arrayBuffer);
                
                const floatData = audioData.getChannelData(0);
                const sampleRate = audioData.sampleRate;
                
                log(`Audio decoded: ${floatData.length} samples at ${sampleRate}Hz`);
                
                // Log audio stats for debugging
                let maxAmplitude = 0;
                let sumAmplitude = 0;
                for (let i = 0; i < floatData.length; i++) {
                    maxAmplitude = Math.max(maxAmplitude, Math.abs(floatData[i]));
                    sumAmplitude += Math.abs(floatData[i]);
                }
                const avgAmplitude = sumAmplitude / floatData.length;
                log(`Audio stats: max amplitude = ${maxAmplitude.toFixed(4)}, avg amplitude = ${avgAmplitude.toFixed(4)}`);
                
                // If ggwave isn't initialized, try again
                if (!ggwave || !ggwaveInstance) {
                    log('GGWave not initialized, attempting initialization...', 'warning');
                    const success = await initGGWave();
                    
                    if (!success) {
                        log('Failed to initialize GGWave', 'error');
                        circleText.textContent = '';
                        statusDisplay.textContent = 'GGWave initialization failed. Please refresh.';
                        loadingIndicator.classList.remove('visible');
                        return;
                    }
                }
                
                // Attempt to decode using the gibberlink pattern
                log('Decoding with ggwave...');
                let decoded = null;
                
                try {
                    // Following gibberlink pattern, convert floatData to Int8Array
                    const int8Data = convertTypedArray(floatData, Int8Array);
                    
                    // Decode using ggwave's decode method with instance
                    const result = ggwave.decode(ggwaveInstance, int8Data);
                    log(`Raw decode result type: ${result ? typeof result : 'null'}`);
                    
                    // In gibberlink, it converts the result to text
                    if (result && result.length > 0) {
                        try {
                            // Try to decode as UTF-8, similar to gibberlink
                            decoded = new TextDecoder("utf-8").decode(result);
                            log(`Decoded text: ${decoded}`);
                        } catch (e) {
                            log(`Error decoding UTF-8: ${e.message}`, 'warning');
                            // Just use the raw result if TextDecoder fails
                            decoded = result.toString();
                        }
                    }
                    
                    // If no valid signal data, try simulating a signature for testing on mobile
                    if ((!decoded || decoded.length === 0) && maxAmplitude > 0.01) {
                        log('No valid signal detected, but audio present. Using test signature for debugging.', 'warning');
                        
                        // Special mobile testing fallback - only use if actual audio was detected
                        // Remove this in production
                        decoded = "mobile_test_signature_" + new Date().getTime();
                    }
                } catch (decodeError) {
                    log(`Error in ggwave.decode: ${decodeError.message}`, 'error');
                    circleText.textContent = '';
                    statusDisplay.textContent = 'Error decoding audio. Please try again.';
                    // Show agent profile link for all cases
                    document.getElementById('agentProfileLink').style.display = 'block';
                    loadingIndicator.classList.remove('visible');
                    return;
                }
                
                if (decoded && decoded.length > 0) {
                    log(`Decoded text found: ${decoded}`);
                    const decodedText = decoded;
                    // Hide this text since we don't want it displayed
                    circleText.textContent = '';
                    
                    // Display the decoded text in a clean format
                    // If it's too long, truncate it with ellipsis
                    statusDisplay.textContent = decodedText.length > 40 
                        ? decodedText.substring(0, 40) + '...' 
                        : decodedText;
                    
                    // Show agent profile link
                    document.getElementById('agentProfileLink').style.display = 'block';
                    
                    // Send to server for validation
                    await validateDecodedText(decodedText);
                } else {
                    log('No ggwave data detected in audio', 'warning');
                    circleText.textContent = '';
                    statusDisplay.textContent = 'No signal detected. Please try again.';
                    // Show agent profile link for all cases
                    document.getElementById('agentProfileLink').style.display = 'block';
                    loadingIndicator.classList.remove('visible');
                }
            } catch (decodeError) {
                log(`Error decoding audio data: ${decodeError.message}`, 'error');
                circleText.textContent = '';
                statusDisplay.textContent = 'Error processing audio format. Please try again.';
                // Show agent profile link for all cases
                document.getElementById('agentProfileLink').style.display = 'block';
                loadingIndicator.classList.remove('visible');
            }
        } catch (error) {
            log(`Error processing recording: ${error.message}`, 'error');
            circleText.textContent = '';
            statusDisplay.textContent = 'Error processing audio. Please try again.';
            // Show agent profile link for all cases
            document.getElementById('agentProfileLink').style.display = 'block';
            loadingIndicator.classList.remove('visible');
        }
    }
    
    // Send decoded text to server for validation
    async function validateDecodedText(decodedText) {
        try {
            log(`Sending decoded text to server for validation: ${decodedText}`);
            const response = await fetch('/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    decoded_text: decodedText
                })
            });
            
            log(`Server response status: ${response.status}`);
            const result = await response.json();
            log(`Server validation result: ${JSON.stringify(result)}`);
            
            if (result.status === 'success') {
                if (result.verified) {
                    log('Signature verification successful!');
                    circleText.textContent = '';
                    statusDisplay.textContent = `${result.extracted_message}`;
                    // Show agent profile link
                    document.getElementById('agentProfileLink').style.display = 'block';
                } else {
                    log('Signature verification failed', 'warning');
                    circleText.textContent = '';
                    statusDisplay.textContent = 'Signature could not be verified.';
                    // Show agent profile link for all cases
                    document.getElementById('agentProfileLink').style.display = 'block';
                }
            } else {
                log(`Server error: ${result.message}`, 'error');
                circleText.textContent = '';
                statusDisplay.textContent = result.message || 'Error validating the signature.';
                // Show agent profile link for all cases
                document.getElementById('agentProfileLink').style.display = 'block';
            }
        } catch (error) {
            log(`Error communicating with server: ${error.message}`, 'error');
            circleText.textContent = '';
            statusDisplay.textContent = 'Error communicating with the server.';
            // Show agent profile link for all cases
            document.getElementById('agentProfileLink').style.display = 'block';
        } finally {
            loadingIndicator.classList.remove('visible');
        }
    }
    
    // Handle button click
    validateBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });
    
    // Don't auto-initialize - wait for user interaction
    statusDisplay.textContent = 'Click "Validate" to start';
    log('App initialized, waiting for user interaction');
}); 