# VoxVerify

VoxVerify is a secure voice-based verification system that uses audio signals to transmit cryptographically signed messages. It combines audio encoding with cryptographic verification to create a robust identity verification mechanism.

## Features

- **Voice-based verification**: Uses audio signals to transmit verification data
- **Cryptographic security**: Implements Ed25519 signature verification
- **Interactive 3D visualization**: Visual feedback during audio verification
- **Wallet integration**: Basic cryptocurrency wallet interface
- **Rating system**: Collect feedback on verification quality

## Technology Stack

- Python + Flask for the backend
- ggwave for audio signal encoding/decoding
- cryptography library for digital signatures
- Three.js for 3D visualization
- HTML/CSS/JavaScript for the frontend

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/voxverify.git
   cd voxverify
   ```

2. Install the required Python packages:
   ```
   pip install flask sounddevice numpy cryptography ggwave
   ```

3. Make sure you have an Ed25519 key pair in your `~/.ssh` directory:
   ```
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
   ```

## Usage

1. Start the server:
   ```
   python play.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:6000
   ```

3. The web interface has two main tabs:
   - **Identify**: Record and validate voice verification codes
   - **Review**: View wallet information and provide feedback

## API Endpoints

### Identification

- `POST /identify`: Encrypts/signs a message and plays it as audio
  - Request body: `{"message": "your message"}`
  - Response: Returns the signature and status

### Validation

- `POST /validate`: Validates a decoded audio signature
  - Request body: `{"decoded_text": "encoded signature"}`
  - Response: Returns verification status and extracted message

### Wallet

- `POST /refresh_wallet`: Simulates refreshing a blockchain wallet
  - Request body: `{"wallet_address": "wallet address"}`
  - Response: Returns wallet balance information

### Review

- `GET /review`: Submits rating data for verification quality
  - Query parameters: `ratings` (space-separated list of four numbers: accuracy, completion, flow, resolution)
  - Example: `/review?ratings=5%206%208%2010`
  - Response: Confirmation of ratings received

### Other

- `GET /signatures`: Lists recent signatures and their original messages

## License

[License information here]

## Contributing

[Contribution guidelines here] 