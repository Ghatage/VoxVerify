import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/UnrealBloomPass.js';

// AudioVisualizer class - handles 3D visualization of audio data
export class AudioVisualizer {
    constructor(container, audioContext, analyser) {
        this.container = container;
        this.audioContext = audioContext;
        this.analyser = analyser;
        this.analyser.fftSize = 512;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.isActive = false;
        
        // Clock to track time for shader animation
        this.clock = new THREE.Clock();
        
        // Add a property to store the last frequency value for smoother transitions
        this.lastFrequency = 0;
        // Add decay factor for slower reverting of spikes (smaller = slower)
        this.decayFactor = 0.05;
        
        // Initialize Three.js scene
        this.initThree();
        
        // Start animation
        this.animate();
        
        console.log('AudioVisualizer initialized');
    }
    
    // Start method to be compatible with existing app.js code
    start() {
        console.log('AudioVisualizer start method called');
        this.isActive = true;
        
        // Keep bloom consistent with non-recording state
        if (this.bloomPass) {
            // Only slight increase for subtle feedback
            this.bloomPass.strength = 1.9;
        }
        
        // Keep emissive intensity consistent
        if (this.sphere && this.sphere.material) {
            // No change from non-recording state
            this.sphere.material.emissiveIntensity = 2.0;
            // Make sure wireframe is preserved
            this.sphere.material.wireframe = true;
            // Ensure opacity isn't too high
            this.sphere.material.opacity = 0.8;
        }
        
        // Keep backlight consistent but slightly enhanced
        if (this.backLight) {
            // Small increase to preserve the backlight effect
            this.backLight.intensity = 1.8;
        }
        
        // Keep glow sphere opacity consistent
        if (this.glowSphere) {
            // No change from non-recording state
            this.glowSphere.material.opacity = 0.3;
        }
        
        // Keep tone mapping consistent
        if (this.renderer) {
            // No change from non-recording state
            this.renderer.toneMappingExposure = 1.5;
        }
    }
    
    initThree() {
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.z = 5;
        
        // Renderer setup with enhanced quality and tone mapping
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x000000, 0); // Transparent background
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add tone mapping for better glow effects
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        
        this.container.appendChild(this.renderer.domElement);
        
        // Add orbit controls with zoom disabled
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.15;
        this.controls.rotateSpeed = 0.5;
        this.controls.enableZoom = false; // Disable zoom
        this.controls.enablePan = false; // Disable panning
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.3;
        
        // Create enhanced glowing sphere
        this.createGlowingSphere();
        
        // Add simple post-processing
        this.setupPostProcessing();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createGlowingSphere() {
        // Create geometry with high detail
        const geometry = new THREE.IcosahedronGeometry(1.8, 5);
        
        // Use standard material with emissive properties for glow
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.0,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            roughness: 0.1,
            metalness: 0.8
        });
        
        // Create the sphere mesh
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);
        
        // Create a second, slightly larger solid sphere behind for additional glow
        const glowGeometry = new THREE.SphereGeometry(2.0, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3, // Increased default opacity for better glow
            side: THREE.BackSide // Only render the back side
        });
        this.glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(this.glowSphere);
        
        // Store original vertices for animation
        this.originalVertices = [];
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            this.originalVertices.push({
                x: positions[i],
                y: positions[i + 1],
                z: positions[i + 2]
            });
        }
        
        // Add lights to enhance the glow effect
        const frontLight = new THREE.PointLight(0xffffff, 1.0, 100);
        frontLight.position.set(5, 5, 5);
        this.scene.add(frontLight);
        
        // Add strong backlight for the persistent backlit glow
        this.backLight = new THREE.PointLight(0xffffff, 1.5, 100);
        this.backLight.position.set(-5, 0, -5);
        this.scene.add(this.backLight);
        
        // Add side lights for more dimensional glow
        const topLight = new THREE.PointLight(0xffffff, 0.7, 100);
        topLight.position.set(0, 5, -3);
        this.scene.add(topLight);
        
        // Add ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
    }
    
    // Utility functions for Perlin noise
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    // Simple Perlin-like noise function
    noise(x, y, z) {
        // Use the sphere's position plus time as input
        const time = this.clock.getElapsedTime() * 0.5;
        return Math.sin(x * 10 + time) * Math.cos(y * 10 + time) * Math.sin(z * 10 + time);
    }
    
    setupPostProcessing() {
        // Create effect composer
        this.composer = new EffectComposer(this.renderer);
        
        // Add render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Add enhanced bloom with stronger effect
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.8,  // increased strength
            0.5,  // radius
            0.6   // threshold (lower for more glow areas)
        );
        this.composer.addPass(this.bloomPass);
    }
    
    // Add method to handle the frequency data that's called from app.js
    updateFrequencyData(frequency) {
        // Store frequency for use in the update method
        this.currentFrequency = frequency;
    }
    
    update(dataArray) {
        if (!this.sphere) return;
        
        // Calculate average frequency for visualization
        const averageFrequency = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        // Use the higher of the stored or calculated frequency
        let targetFrequency = this.isActive ? 
            Math.max(this.currentFrequency || 0, averageFrequency * 3) : 
            6.0;
            
        // Apply asymmetric smoothing:
        // - Fast rise: If new value is higher, adopt it quickly
        // - Slow fall: If new value is lower, transition to it gradually
        if (targetFrequency > this.lastFrequency) {
            // Fast rise - immediately adopt the higher value
            this.lastFrequency = targetFrequency;
        } else {
            // Slow fall - gradually decrease toward the target
            this.lastFrequency = this.lastFrequency * (1 - this.decayFactor) + targetFrequency * this.decayFactor;
        }
        
        // Use the smoothed frequency value for visualization
        const frequency = this.lastFrequency;
            
        // Ensure wireframe is always visible
        if (this.sphere.material) {
            this.sphere.material.wireframe = true;
            
            // Adjust the material opacity to ensure wireframe is visible
            // Lower opacity during recording makes the wireframe more defined
            this.sphere.material.opacity = this.isActive ? 0.7 : 0.8;
        }
        
        // Apply displacement to sphere vertices
        if (this.sphere.geometry && this.originalVertices) {
            const time = this.clock.getElapsedTime() * 0.5;
            const positions = this.sphere.geometry.attributes.position.array;
            
            for (let i = 0, j = 0; i < this.originalVertices.length; i++, j += 3) {
                const vertex = this.originalVertices[i];
                
                // Generate noise based on original position and time
                const noise = this.noise(vertex.x, vertex.y, vertex.z);
                
                // Scale displacement based on frequency, but limit maximum to prevent solid appearance
                // Reduce displacement during recording to prevent solid appearance
                const displacementFactor = this.isActive ? 15.0 : 20.0;
                const displacement = (frequency / displacementFactor) * (noise / 8.0);
                
                // Calculate normal vector (normalized original vertex for a sphere)
                const normalX = vertex.x / 1.8;
                const normalY = vertex.y / 1.8;
                const normalZ = vertex.z / 1.8;
                
                // Apply displacement along normal direction
                positions[j] = vertex.x + normalX * displacement;
                positions[j + 1] = vertex.y + normalY * displacement;
                positions[j + 2] = vertex.z + normalZ * displacement;
            }
            
            // Update geometry
            this.sphere.geometry.attributes.position.needsUpdate = true;
        }
        
        // Rotate the sphere slowly
        if (this.sphere) {
            this.sphere.rotation.x += 0.001;
            this.sphere.rotation.y += 0.002;
        }
        
        // Make the glow sphere follow the main sphere's rotation
        if (this.glowSphere) {
            this.glowSphere.rotation.copy(this.sphere.rotation);
            
            // Pulse the glow sphere opacity slightly for additional visual interest
            const pulseAmount = Math.sin(this.clock.getElapsedTime() * 2) * 0.05;
            
            // Keep consistent glow with minor pulsing, with slight increase during recording
            const baseOpacity = 0.3;
            const recordingBoost = this.isActive ? 0.05 : 0;
            this.glowSphere.material.opacity = baseOpacity + recordingBoost + pulseAmount;
        }
    }
    
    animate() {
        this.frameId = requestAnimationFrame(() => this.animate());
        
        // Get audio data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Update visualization
        this.update(this.dataArray);
        
        // Update controls
        this.controls.update();
        
        // Render scene with post-processing
        this.composer.render();
    }
    
    onWindowResize() {
        // Update camera aspect ratio
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer and composer sizes
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    stop() {
        if (this.frameId) {
            // Set the active flag to false
            this.isActive = false;
            
            // Reset bloom to normal level
            if (this.bloomPass) {
                this.bloomPass.strength = 1.8;
            }
            
            // Reset emissive intensity - should already be consistent
            if (this.sphere && this.sphere.material) {
                this.sphere.material.emissiveIntensity = 2.0;
                this.sphere.material.wireframe = true;
                this.sphere.material.opacity = 0.8;
            }
            
            // Reset backlight intensity
            if (this.backLight) {
                this.backLight.intensity = 1.5;
            }
            
            // Reset glow sphere opacity - should already be consistent
            if (this.glowSphere) {
                this.glowSphere.material.opacity = 0.3;
            }
            
            // Reset tone mapping - should already be consistent
            if (this.renderer) {
                this.renderer.toneMappingExposure = 1.5;
            }
        }
    }
    
    // Clean up resources
    dispose() {
        this.stop();
        
        // Actually stop the animation frame
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        
        // Dispose of Three.js resources
        if (this.sphere) {
            this.scene.remove(this.sphere);
            this.sphere.geometry.dispose();
            this.sphere.material.dispose();
            this.sphere = null;
        }
        
        if (this.glowSphere) {
            this.scene.remove(this.glowSphere);
            this.glowSphere.geometry.dispose();
            this.glowSphere.material.dispose();
            this.glowSphere = null;
        }
        
        // Remove canvas from container
        if (this.renderer && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }
        
        // Dispose of renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
} 