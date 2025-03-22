use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

/// Define the data structure for our Agent
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Agent {
    pub agent_name: String,
    pub agent_id: String,
    pub agent_public_key: String,
    pub signing_authority: String,
    pub number_of_calls: String,
    pub avg_customer_rating: String,
}

/// Define the instructions our program can process
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum AgentStoreInstruction {
    /// Create/Update an agent
    /// 0: [signer] The account funding the operation
    /// 1: [writable] The agent account
    Upsert(Agent),
}

// Declare the program entrypoint
entrypoint!(process_instruction);

// Program entrypoint implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Deserialize the instruction
    let instruction = AgentStoreInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        AgentStoreInstruction::Upsert(agent) => {
            msg!("Instruction: Upsert Agent");
            process_upsert_agent(program_id, accounts, agent)
        }
    }
}

// Process Upsert instruction
pub fn process_upsert_agent(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    agent: Agent,
) -> ProgramResult {
    // Get account iterator
    let account_info_iter = &mut accounts.iter();
    
    // Get accounts
    let funder = next_account_info(account_info_iter)?;
    let agent_account = next_account_info(account_info_iter)?;
    
    // Ensure the account is owned by our program
    if agent_account.owner != program_id {
        msg!("Agent account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    // Ensure the signer has authority
    if !funder.is_signer {
        msg!("Funder is not a signer");
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // Store agent data in the account
    agent.serialize(&mut &mut agent_account.data.borrow_mut()[..])?;
    
    Ok(())
}
