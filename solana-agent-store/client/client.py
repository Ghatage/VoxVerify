from solana.rpc.api import Client
from solana.rpc.types import TxOpts
from solana.keypair import Keypair
from solana.transaction import Transaction
from solana.system_program import CreateAccountParams, create_account
from solana.publickey import PublicKey
import borsh
from borsh_construct import String, CStruct

# Define the Agent class for serialization/deserialization
class Agent:
    schema = CStruct(
        "agent_name" / String,
        "agent_id" / String,
        "agent_public_key" / String,
        "signing_authority" / String,
        "number_of_calls" / String,
        "avg_customer_rating" / String,
    )
    
    def __init__(self, agent_name, agent_id, agent_public_key, signing_authority, number_of_calls, avg_customer_rating):
        self.agent_name = agent_name
        self.agent_id = agent_id
        self.agent_public_key = agent_public_key
        self.signing_authority = signing_authority
        self.number_of_calls = number_of_calls
        self.avg_customer_rating = avg_customer_rating
    
    def serialize(self):
        return self.schema.build({
            "agent_name": self.agent_name,
            "agent_id": self.agent_id,
            "agent_public_key": self.agent_public_key,
            "signing_authority": self.signing_authority,
            "number_of_calls": self.number_of_calls,
            "avg_customer_rating": self.avg_customer_rating,
        })
    
    @classmethod
    def deserialize(cls, data):
        decoded = cls.schema.parse(data)
        return cls(
            agent_name=decoded.agent_name,
            agent_id=decoded.agent_id,
            agent_public_key=decoded.agent_public_key,
            signing_authority=decoded.signing_authority,
            number_of_calls=decoded.number_of_calls,
            avg_customer_rating=decoded.avg_customer_rating,
        )

class AgentStoreClient:
    def __init__(self, rpc_url="https://api.devnet.solana.com"):
        self.client = Client(rpc_url)
        # Replace with your program ID after deployment
        self.program_id = PublicKey("YOUR_PROGRAM_ID_HERE")
    
    def create_agent_account(self, payer, agent_id, space=1000):
        """Create a new account to store agent data"""
        # Derive a PDA (Program Derived Address) for the agent
        # This creates a deterministic address based on the agent_id
        seeds = [bytes(agent_id, 'utf-8')]
        agent_pubkey, bump = PublicKey.find_program_address(seeds, self.program_id)
        
        # Calculate rent-exempt balance
        resp = self.client.get_minimum_balance_for_rent_exemption(space)
        lamports = resp["result"]
        
        # Create transaction to create the account
        transaction = Transaction()
        
        # Add create account instruction
        create_acct_ix = create_account(
            CreateAccountParams(
                from_pubkey=payer.public_key,
                new_account_pubkey=agent_pubkey,
                lamports=lamports,
                space=space,
                program_id=self.program_id
            )
        )
        transaction.add(create_acct_ix)
        
        # Sign and send transaction
        result = self.client.send_transaction(
            transaction, payer, opts=TxOpts(skip_preflight=True)
        )
        
        return agent_pubkey, result
    
    def update_agent(self, payer, agent):
        """Update agent data"""
        # Derive the agent's account address
        seeds = [bytes(agent.agent_id, 'utf-8')]
        agent_pubkey, _ = PublicKey.find_program_address(seeds, self.program_id)
        
        # Create instruction data (UPSERT = 0, followed by serialized agent data)
        instruction_data = bytes([0]) + agent.serialize()
        
        # Create transaction
        transaction = Transaction().add(
            TransactionInstruction(
                keys=[
                    AccountMeta(payer.public_key, is_signer=True, is_writable=True),
                    AccountMeta(agent_pubkey, is_signer=False, is_writable=True),
                ],
                program_id=self.program_id,
                data=instruction_data,
            )
        )
        
        # Sign and send transaction
        result = self.client.send_transaction(
            transaction, payer, opts=TxOpts(skip_preflight=True)
        )
        
        return result
    
    def get_agent(self, agent_id):
        """Read agent data"""
        # Derive the agent's account address
        seeds = [bytes(agent_id, 'utf-8')]
        agent_pubkey, _ = PublicKey.find_program_address(seeds, self.program_id)
        
        # Get account data
        account_info = self.client.get_account_info(agent_pubkey)
        
        if not account_info["result"]["value"]:
            return None
        
        # Deserialize the data
        data = bytes(account_info["result"]["value"]["data"][0])
        agent = Agent.deserialize(data)
        
        return agent

""" Example usage
if __name__ == "__main__":
    from solana.keypair import Keypair
    from solana.transaction import TransactionInstruction
    from solana.rpc.types import AccountMeta
    
    # Initialize client
    client = AgentStoreClient()
    
    # Create keypair for testing (in practice, load from secure storage)
    payer = Keypair.generate()
    
    # Airdrop some SOL (only for devnet/testnet)
    client.client.request_airdrop(payer.public_key, 1000000000)  # 1 SOL in lamports
    
    # Create a new agent
    agent = Agent(
        agent_name="Agent Smith",
        agent_id="agent001",
        agent_public_key="11111111111111111111111111111111",
        signing_authority="self",
        number_of_calls="0",
        avg_customer_rating="0.0"
    )
    
    # Create agent account
    agent_pubkey, create_result = client.create_agent_account(payer, agent.agent_id)
    print(f"Created agent account: {agent_pubkey}")
    
    # Update agent data
    update_result = client.update_agent(payer, agent)
    print(f"Updated agent data: {update_result}")
    
    # Get agent data
    retrieved_agent = client.get_agent(agent.agent_id)
    print(f"Retrieved agent: {retrieved_agent.__dict__}")
    
    # Update agent data
    agent.number_of_calls = "10"
    agent.avg_customer_rating = "4.5"
    update_result = client.update_agent(payer, agent)
    print(f"Updated agent with new stats: {update_result}")
    
    # Get updated agent data
    retrieved_agent = client.get_agent(agent.agent_id)
    print(f"Retrieved updated agent: {retrieved_agent.__dict__}")
"""
