from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class RegisterRequest(BaseModel):
    fullName: str
    email: str
    password: str
    accountMode: Optional[str] = "family"  # family, myself, teen
    role: Optional[str] = "individual"     # parent, child, individual
    age: Optional[int] = 25
    currency: Optional[str] = "INR"        # INR, USD
    parentEmail: Optional[str] = None
    accountabilityPartnerEmail: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class CurrencyUpdateRequest(BaseModel):
    currency: str

class PlanSplitUpdateRequest(BaseModel):
    everyday: int
    emergency: int
    savings: int

class GoalCreateRequest(BaseModel):
    name: str
    category: Optional[str] = "other"
    targetAmount: Any
    deadline: str
    priority: Optional[str] = "medium"
    icon: Optional[str] = "🎯"
    autoSaveAmount: Optional[Any] = 0
    autoSaveFrequency: Optional[str] = "none"
    roundUpEnabled: Optional[bool] = False

class GoalDepositRequest(BaseModel):
    amount: Any

class SimulateSpendRequest(BaseModel):
    spendAmount: Any
    note: Optional[str] = "Simulated Card Purchase"

class GoalWithdrawRequest(BaseModel):
    amount: Any
    reason: Optional[str] = "Early Goal Withdrawal"

class FinalizeCoolingOffRequest(BaseModel):
    simulate_bypass: Optional[bool] = False

class FundWalletRequest(BaseModel):
    amount: Any
    note: Optional[str] = "Wallet funded"

class ChildApprovalRequest(BaseModel):
    amount: Any
    reason: str

class ReviewApprovalRequest(BaseModel):
    decision: str  # approved, rejected

class LearningCompleteRequest(BaseModel):
    moduleId: str

class AppEventRequest(BaseModel):
    action: str
    details: Optional[str] = ""

class AiSuggestionRequest(BaseModel):
    amount: Any
    splitPercentages: Optional[Dict[str, Any]] = None
    studentName: Optional[str] = "Saver"
    age: Optional[int] = 25
    role: Optional[str] = "individual"
    accountMode: Optional[str] = "myself"
    currency: Optional[str] = "INR"
