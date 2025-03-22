# Minimal imports
from solders.keypair import Keypair  # For key handling
from solders.pubkey import Pubkey    # For addresses
from solana.rpc.api import Client    # For RPC communication

class Agent:
    """Agent data structure"""
    def __init__(self, agent_name, agent_id, agent_public_key, signing_authority, number_of_calls, avg_customer_rating):
        self.agent_name = agent_name
        self.agent_id = agent_id
        self.agent_public_key = agent_public_key
        self.signing_authority = signing_authority
        self.number_of_calls = number_of_calls
        self.avg_customer_rating = avg_customer_rating
    
    def to_dict(self):
        """Convert to dictionary for easy serialization"""
        return {
            "agent_name": self.agent_name,
            "agent_id": self.agent_id,
            "agent_public_key": self.agent_public_key,
            "signing_authority": self.signing_authority,
            "number_of_calls": self.number_of_calls,
            "avg_customer_rating": self.avg_customer_rating
        }
    
    @classmethod
    def from_dict(cls, data):
        """Create from dictionary"""
        return cls(
            agent_name=data.get("agent_name", ""),
            agent_id=data.get("agent_id", ""),
            agent_public_key=data.get("agent_public_key", ""),
            signing_authority=data.get("signing_authority", ""),
            number_of_calls=data.get("number_of_calls", "0"),
            avg_customer_rating=data.get("avg_customer_rating", "0.0")
        )

class AgentStoreClient:
    """Simplified client that only provides reading functionality"""
    def __init__(self, rpc_url="http://localhost:8899"):
        self.client = Client(rpc_url)
        # Replace with your program ID after deployment
        self.program_id = Pubkey.from_string("MGEB8Ba6ydpGj3FgjA9q79Az37xX9nuvBKbGqV2n8Ji")
    
    def get_program_accounts(self):
        """Get all accounts owned by the program"""
        response = self.client.get_program_accounts(self.program_id)
        accounts = []
        
        if response.value:
            for account in response.value:
                # Here we would parse the account data
                # For now, just return the raw data
                accounts.append({
                    "pubkey": account.pubkey,
                    "data": account.account.data
                })
        
        return accounts
    
    def get_account_info(self, pubkey):
        """Get info for a specific account"""
        response = self.client.get_account_info(pubkey)
        return response.value if response.value else None

# Example usage showing just the querying part
if __name__ == "__main__":
    # Initialize client
    client = AgentStoreClient()
    
    # Get all program accounts
    accounts = client.get_program_accounts()
    print(f"Found {len(accounts)} accounts")
    
    for account in accounts:
        print(f"Account: {account['pubkey']}")
