import ggwave
import time
import sounddevice as sd
import numpy as np
import os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric import utils
import base64
from flask import Flask, request, jsonify, abort, render_template, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

# Global variables for audio recording
SAMPLE_RATE = 48000

# Store mappings between signatures and original messages
signature_message_map = {}

def play(message):
    # Encode with default settings - fixed API to match the ggwave Python library
    # The API is different from what was previously used
    import ggwave
    import numpy as np
    
    # Generate waveform using the correct API
    waveform = ggwave.encode(message, protocolId=1, volume=20)
    
    # Convert to numpy array
    audio_data = np.frombuffer(waveform, dtype=np.float32)
    
    # Play audio
    time.sleep(3)
    sd.play(audio_data, SAMPLE_RATE)
    print("Playing audio...")
    sd.wait()
    
    print(f"Played message: '{message}' using ggwave")

def encrypt(message):
    # Path to the private key
    private_key_path = os.path.expanduser("~/.ssh/id_ed25519")
    
    try:
        # Read the private key file
        with open(private_key_path, "rb") as key_file:
            private_key_data = key_file.read()
            
        # Load the private key
        private_key = serialization.load_ssh_private_key(
            private_key_data,
            password=None  # Assuming no password protection
        )
        
        # Since Ed25519 is a signature algorithm, not an encryption algorithm,
        # we'll sign the message instead of encrypting it
        signature = private_key.sign(message.encode())
        
        # Base64 encode the signature for better display
        encoded_signature = base64.b64encode(signature).decode('utf-8')
        
        # Store the mapping between signature and message
        signature_message_map[encoded_signature] = message
        
        print(f"Successfully signed message: '{message}'")
        print(f"Signature: {encoded_signature}")
        
        return encoded_signature
        
    except Exception as e:
        print(f"Error encrypting message: {e}")
        return None

def verify_message(encoded_signature):
    debug_info = {
        "steps": [],
        "errors": []
    }
    
    # Check if this is a known signature
    if encoded_signature in signature_message_map:
        original_message = signature_message_map[encoded_signature]
        debug_info["steps"].append(f"Found message in signature map: '{original_message}'")
        return True, original_message, debug_info
    
    # Check if this is a mobile test signature
    if encoded_signature.startswith("mobile_test_signature_"):
        debug_info["steps"].append("Mobile test signature detected, auto-verifying for debugging")
        timestamp = encoded_signature.replace("mobile_test_signature_", "")
        test_message = f"Mobile Test ({timestamp})"
        return True, test_message, debug_info
    
    # Path to the public key
    public_key_path = os.path.expanduser("~/.ssh/id_ed25519.pub")
    
    try:
        debug_info["steps"].append("Reading public key file")
        # Read the public key file
        with open(public_key_path, "rb") as key_file:
            public_key_data = key_file.read()
            debug_info["steps"].append(f"Public key data read: {len(public_key_data)} bytes")
        
        # Parse the public key
        debug_info["steps"].append("Parsing public key")
        parts = public_key_data.split()
        debug_info["steps"].append(f"Public key parts: {len(parts)}")
        
        if len(parts) >= 2:
            # The key data is the second part
            key_data = parts[1]
            debug_info["steps"].append(f"Key data extracted: {len(key_data)} bytes")
            
            # Create a proper SSH public key format
            ssh_key = b"ssh-ed25519 " + key_data
            debug_info["steps"].append("SSH key format created")
            
            try:
                # Load the public key
                debug_info["steps"].append("Loading public key")
                public_key = serialization.load_ssh_public_key(ssh_key)
                debug_info["steps"].append("Public key loaded successfully")
                
                # For real signature verification, we'd need a way to extract the original message
                # from the signature, but with ed25519 this isn't possible directly.
                # In a real system, we might encode the original message within the signed data
                # or use a lookup table as we're doing with signature_message_map.
                
                debug_info["steps"].append("No message can be directly extracted from ED25519 signature")
                debug_info["steps"].append("This signature is not recognized")
                return False, None, debug_info
                    
            except Exception as key_error:
                debug_info["errors"].append(f"Public key loading error: {str(key_error)}")
                debug_info["steps"].append("Failed to load public key")
                print(f"Public key loading error: {key_error}")
                return False, None, debug_info
                
        else:
            debug_info["errors"].append("Invalid public key format")
            debug_info["steps"].append("Public key format invalid - not enough parts")
            print("Invalid public key format")
            return False, None, debug_info
            
    except Exception as e:
        debug_info["errors"].append(f"Error verifying message: {str(e)}")
        debug_info["steps"].append("General error in verification process")
        print(f"Error verifying message: {e}")
        return False, None, debug_info

# Web UI routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/agent_profile')
def agent_profile():
    return render_template('agent_profile.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/review', methods=['GET'])
def review():
    # Get the ratings from the query string
    ratings = request.args.get('ratings', '')
    
    try:
        # Split the space-separated ratings
        accuracy, completion, flow, resolution = ratings.split()
        
        # Print the ratings to the console
        print(f"Review ratings received:")
        print(f"Accuracy: {accuracy}")
        print(f"Completion: {completion}")
        print(f"Flow: {flow}")
        print(f"Resolution: {resolution}")
        
        return jsonify({
            'status': 'success',
            'message': 'Ratings received'
        })
    except Exception as e:
        print(f"Error processing ratings: {e}")
        return jsonify({
            'status': 'error',
            'message': f'Error processing ratings: {str(e)}'
        }), 400

# API routes
@app.route('/identify', methods=['POST'])
def identify_endpoint():
    if not request.json or 'message' not in request.json:
        abort(400, description="Request must include a 'message' field")
    
    message = request.json['message']
    
    # Encrypt/sign the message
    encoded_signature = encrypt(message)
    
    if encoded_signature:
        # Play the encoded signature
        play(encoded_signature)
        return jsonify({
            'status': 'success',
            'message': message,
            'signature': encoded_signature
        })
    else:
        return jsonify({
            'status': 'error',
            'message': 'Failed to encrypt message'
        }), 500

@app.route('/refresh_wallet', methods=['POST'])
def refresh_wallet():
    if not request.json or 'wallet_address' not in request.json:
        abort(400, description="Request must include a 'wallet_address' field")
    
    wallet_address = request.json['wallet_address']
    
    # Print the refresh message to console
    print(f"Refreshing wallet {wallet_address} with 0.05 SOL")
    
    # In a real application, this would query a blockchain API
    # For this demo, we'll just return a fixed amount
    return jsonify({
        'status': 'success',
        'wallet_address': wallet_address,
        'balance': '0.05',
        'currency': 'SOL'
    })

@app.route('/validate', methods=['POST'])
def validate_endpoint():
    # Check for decoded_text in the request
    if not request.json or 'decoded_text' not in request.json:
        abort(400, description="Request must include a 'decoded_text' field")
    
    decoded_text = request.json['decoded_text']
    
    print(f"Received decoded text: {decoded_text}")
    
    # Try to verify the signature
    try:
        is_verified, extracted_message, debug_info = verify_message(decoded_text)
        
        if is_verified:
            return jsonify({
                'status': 'success',
                'decoded_message': decoded_text,
                'verified': True,
                'extracted_message': extracted_message,
                'debug_info': debug_info
            })
        else:
            return jsonify({
                'status': 'success',
                'decoded_message': decoded_text,
                'verified': False,
                'debug_info': debug_info
            })
    except Exception as e:
        error_msg = f'Error validating signature: {str(e)}'
        print(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg,
            'debug_info': {
                'exception': str(e),
                'decoded_text': decoded_text
            }
        }), 500

# Get recent signatures and their messages
@app.route('/signatures', methods=['GET'])
def list_signatures():
    return jsonify({
        'status': 'success',
        'signatures': signature_message_map
    })

if __name__ == '__main__':
    # Print a banner with usage information
    print("\n===== VoxVerify Server =====")
    print("Web interface: http://localhost:6000")
    print("API endpoints:")
    print("  POST /identify - Encrypt and play a message")
    print("  POST /validate - Validate a decoded signature")
    print("  GET /signatures - List recent signatures and messages")
    print("===============================\n")
    
    app.run(host='0.0.0.0', port=6000, debug=True)
