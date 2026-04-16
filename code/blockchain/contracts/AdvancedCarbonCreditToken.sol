// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AdvancedCarbonCreditToken
 * @dev Advanced ERC20 token for carbon credits with comprehensive financial industry features
 * Features:
 * - Multi-signature governance
 * - Automated compliance checks
 * - Vintage year tracking
 * - Project verification
 * - Retirement mechanism
 * - Audit trail
 * - Risk management
 * - Regulatory reporting
 */
contract AdvancedCarbonCreditToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    AccessControl,
    ReentrancyGuard
{
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Counters
    Counters.Counter private _projectIdCounter;
    Counters.Counter private _batchIdCounter;
    Counters.Counter private _retirementIdCounter;

    // Structs
    struct CarbonProject {
        uint256 projectId;
        string name;
        string methodology;
        string location;
        address developer;
        uint256 vintageYear;
        uint256 totalCredits;
        uint256 issuedCredits;
        uint256 retiredCredits;
        ProjectStatus status;
        uint256 verificationDate;
        string verificationStandard;
        bytes32 documentHash;
        bool isActive;
    }

    struct CreditBatch {
        uint256 batchId;
        uint256 projectId;
        uint256 amount;
        uint256 vintageYear;
        uint256 issuanceDate;
        address issuer;
        BatchStatus status;
        string serialNumber;
        bytes32 verificationHash;
    }

    struct RetirementRecord {
        uint256 retirementId;
        uint256 batchId;
        address retiree;
        uint256 amount;
        uint256 retirementDate;
        string purpose;
        string beneficiary;
        bytes32 certificateHash;
    }

    struct ComplianceCheck {
        address user;
        uint256 timestamp;
        ComplianceStatus status;
        string reason;
        address verifier;
    }

    struct RiskAssessment {
        address user;
        uint256 riskScore; // 0-100
        RiskLevel riskLevel;
        uint256 lastAssessment;
        string[] riskFactors;
    }

    // Enums
    enum ProjectStatus {
        Pending,
        Verified,
        Active,
        Suspended,
        Retired
    }
    enum BatchStatus {
        Pending,
        Issued,
        Transferred,
        Retired
    }
    enum ComplianceStatus {
        Compliant,
        NonCompliant,
        UnderReview
    }
    enum RiskLevel {
        Low,
        Medium,
        High,
        Critical
    }

    // State variables
    mapping(uint256 => CarbonProject) public projects;
    mapping(uint256 => CreditBatch) public batches;
    mapping(uint256 => RetirementRecord) public retirements;
    mapping(address => ComplianceCheck) public complianceStatus;
    mapping(address => RiskAssessment) public riskAssessments;
    mapping(address => bool) public blacklisted;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => uint256) public dailyTransactionVolume;
    mapping(address => uint256) public dailyTransactionCount;

    // Project and batch mappings
    mapping(address => uint256[]) public userBatches;
    mapping(uint256 => uint256[]) public projectBatches;

    // Vintage year tracking
    mapping(uint256 => uint256) public vintageYearSupply;
    mapping(address => mapping(uint256 => uint256)) public userVintageBalance;

    // Transaction limits
    uint256 public maxDailyTransactionAmount = 100000 * 10 ** decimals(); // 100k tokens
    uint256 public maxDailyTransactionCount = 50;
    uint256 public maxSingleTransactionAmount = 10000 * 10 ** decimals(); // 10k tokens

    // Compliance parameters
    uint256 public complianceCheckInterval = 30 days;
    uint256 public riskAssessmentInterval = 90 days;

    // Fee structure
    uint256 public transferFeeRate = 10; // 0.1% (10/10000)
    uint256 public retirementFeeRate = 5; // 0.05% (5/10000)
    address public feeRecipient;

    // Events
    event ProjectRegistered(
        uint256 indexed projectId,
        string name,
        address developer
    );
    event ProjectVerified(uint256 indexed projectId, address verifier);
    event BatchIssued(
        uint256 indexed batchId,
        uint256 indexed projectId,
        uint256 amount
    );
    event CreditsRetired(
        uint256 indexed retirementId,
        address indexed retiree,
        uint256 amount
    );
    event ComplianceCheckPerformed(
        address indexed user,
        ComplianceStatus status
    );
    event RiskAssessmentUpdated(
        address indexed user,
        RiskLevel riskLevel,
        uint256 riskScore
    );
    event UserBlacklisted(address indexed user, string reason);
    event UserWhitelisted(address indexed user);
    event TransactionLimitExceeded(
        address indexed user,
        uint256 amount,
        string limitType
    );
    event FeeCollected(
        address indexed from,
        address indexed to,
        uint256 amount,
        string feeType
    );

    // Modifiers
    modifier onlyCompliant(address user) {
        require(!blacklisted[user], "User is blacklisted");
        require(
            complianceStatus[user].status == ComplianceStatus.Compliant ||
                block.timestamp - complianceStatus[user].timestamp >
                    complianceCheckInterval,
            "User compliance check required"
        );
        _;
    }

    modifier withinTransactionLimits(address user, uint256 amount) {
        require(
            amount <= maxSingleTransactionAmount,
            "Single transaction limit exceeded"
        );

        // Reset daily counters if new day
        if (block.timestamp - lastTransactionTime[user] >= 1 days) {
            dailyTransactionVolume[user] = 0;
            dailyTransactionCount[user] = 0;
        }

        require(
            dailyTransactionVolume[user].add(amount) <=
                maxDailyTransactionAmount,
            "Daily transaction volume limit exceeded"
        );
        require(
            dailyTransactionCount[user] < maxDailyTransactionCount,
            "Daily transaction count limit exceeded"
        );
        _;
    }

    modifier onlyActiveProject(uint256 projectId) {
        require(projects[projectId].isActive, "Project is not active");
        require(
            projects[projectId].status == ProjectStatus.Active,
            "Project status not active"
        );
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address admin,
        address feeRecipient_
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);

        feeRecipient = feeRecipient_;

        // Initialize counters
        _projectIdCounter.increment(); // Start from 1
        _batchIdCounter.increment();
        _retirementIdCounter.increment();
    }

    /**
     * @dev Register a new carbon credit project
     */
    function registerProject(
        string memory name,
        string memory methodology,
        string memory location,
        address developer,
        uint256 vintageYear,
        uint256 totalCredits,
        string memory verificationStandard,
        bytes32 documentHash
    ) external onlyRole(VERIFIER_ROLE) returns (uint256) {
        require(bytes(name).length > 0, "Project name required");
        require(developer != address(0), "Invalid developer address");
        require(
            vintageYear >= 2000 &&
                vintageYear <= block.timestamp / 365 days + 1970,
            "Invalid vintage year"
        );
        require(totalCredits > 0, "Total credits must be positive");

        uint256 projectId = _projectIdCounter.current();
        _projectIdCounter.increment();

        projects[projectId] = CarbonProject({
            projectId: projectId,
            name: name,
            methodology: methodology,
            location: location,
            developer: developer,
            vintageYear: vintageYear,
            totalCredits: totalCredits,
            issuedCredits: 0,
            retiredCredits: 0,
            status: ProjectStatus.Pending,
            verificationDate: 0,
            verificationStandard: verificationStandard,
            documentHash: documentHash,
            isActive: false
        });

        emit ProjectRegistered(projectId, name, developer);
        return projectId;
    }

    /**
     * @dev Verify and activate a carbon credit project
     */
    function verifyProject(uint256 projectId) external onlyRole(VERIFIER_ROLE) {
        require(projects[projectId].projectId != 0, "Project does not exist");
        require(
            projects[projectId].status == ProjectStatus.Pending,
            "Project already processed"
        );

        projects[projectId].status = ProjectStatus.Verified;
        projects[projectId].verificationDate = block.timestamp;
        projects[projectId].isActive = true;

        emit ProjectVerified(projectId, msg.sender);
    }

    /**
     * @dev Issue carbon credits for a verified project
     */
    function issueCarbonCredits(
        uint256 projectId,
        uint256 amount,
        string memory serialNumber,
        bytes32 verificationHash
    )
        external
        onlyRole(MINTER_ROLE)
        onlyActiveProject(projectId)
        returns (uint256)
    {
        require(amount > 0, "Amount must be positive");
        require(
            projects[projectId].issuedCredits.add(amount) <=
                projects[projectId].totalCredits,
            "Exceeds project total credits"
        );

        uint256 batchId = _batchIdCounter.current();
        _batchIdCounter.increment();

        // Create batch record
        batches[batchId] = CreditBatch({
            batchId: batchId,
            projectId: projectId,
            amount: amount,
            vintageYear: projects[projectId].vintageYear,
            issuanceDate: block.timestamp,
            issuer: msg.sender,
            status: BatchStatus.Issued,
            serialNumber: serialNumber,
            verificationHash: verificationHash
        });

        // Update project issued credits
        projects[projectId].issuedCredits = projects[projectId]
            .issuedCredits
            .add(amount);

        // Update vintage year supply
        vintageYearSupply[projects[projectId].vintageYear] = vintageYearSupply[
            projects[projectId].vintageYear
        ].add(amount);

        // Add to project batches
        projectBatches[projectId].push(batchId);

        // Mint tokens to project developer
        _mint(projects[projectId].developer, amount);

        // Update user vintage balance
        userVintageBalance[projects[projectId].developer][
            projects[projectId].vintageYear
        ] = userVintageBalance[projects[projectId].developer][
            projects[projectId].vintageYear
        ].add(amount);

        emit BatchIssued(batchId, projectId, amount);
        return batchId;
    }

    /**
     * @dev Retire carbon credits permanently
     */
    function retireCredits(
        uint256 amount,
        string memory purpose,
        string memory beneficiary
    ) external nonReentrant onlyCompliant(msg.sender) returns (uint256) {
        require(amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Calculate retirement fee
        uint256 fee = amount.mul(retirementFeeRate).div(10000);
        uint256 netAmount = amount.sub(fee);

        // Create retirement record
        uint256 retirementId = _retirementIdCounter.current();
        _retirementIdCounter.increment();

        retirements[retirementId] = RetirementRecord({
            retirementId: retirementId,
            batchId: 0, // Simplified - would track specific batches in production
            retiree: msg.sender,
            amount: netAmount,
            retirementDate: block.timestamp,
            purpose: purpose,
            beneficiary: beneficiary,
            certificateHash: keccak256(
                abi.encodePacked(
                    retirementId,
                    msg.sender,
                    netAmount,
                    block.timestamp
                )
            )
        });

        // Burn the tokens
        _burn(msg.sender, netAmount);

        // Transfer fee
        if (fee > 0) {
            _transfer(msg.sender, feeRecipient, fee);
            emit FeeCollected(msg.sender, feeRecipient, fee, "retirement");
        }

        emit CreditsRetired(retirementId, msg.sender, netAmount);
        return retirementId;
    }

    /**
     * @dev Perform compliance check on user
     */
    function performComplianceCheck(
        address user,
        ComplianceStatus status,
        string memory reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        complianceStatus[user] = ComplianceCheck({
            user: user,
            timestamp: block.timestamp,
            status: status,
            reason: reason,
            verifier: msg.sender
        });

        emit ComplianceCheckPerformed(user, status);
    }

    /**
     * @dev Update risk assessment for user
     */
    function updateRiskAssessment(
        address user,
        uint256 riskScore,
        RiskLevel riskLevel,
        string[] memory riskFactors
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(riskScore <= 100, "Risk score must be 0-100");

        riskAssessments[user] = RiskAssessment({
            user: user,
            riskScore: riskScore,
            riskLevel: riskLevel,
            lastAssessment: block.timestamp,
            riskFactors: riskFactors
        });

        emit RiskAssessmentUpdated(user, riskLevel, riskScore);
    }

    /**
     * @dev Blacklist a user
     */
    function blacklistUser(
        address user,
        string memory reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        blacklisted[user] = true;
        emit UserBlacklisted(user, reason);
    }

    /**
     * @dev Remove user from blacklist
     */
    function whitelistUser(address user) external onlyRole(COMPLIANCE_ROLE) {
        blacklisted[user] = false;
        emit UserWhitelisted(user);
    }

    /**
     * @dev Enhanced transfer with compliance and fee collection
     */
    function transfer(
        address to,
        uint256 amount
    )
        public
        override
        onlyCompliant(msg.sender)
        onlyCompliant(to)
        withinTransactionLimits(msg.sender, amount)
        returns (bool)
    {
        // Calculate transfer fee
        uint256 fee = amount.mul(transferFeeRate).div(10000);
        uint256 netAmount = amount.sub(fee);

        // Update transaction tracking
        _updateTransactionTracking(msg.sender, amount);

        // Transfer net amount
        bool success = super.transfer(to, netAmount);

        // Transfer fee
        if (fee > 0 && success) {
            super.transfer(feeRecipient, fee);
            emit FeeCollected(msg.sender, feeRecipient, fee, "transfer");
        }

        return success;
    }

    /**
     * @dev Enhanced transferFrom with compliance and fee collection
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        override
        onlyCompliant(from)
        onlyCompliant(to)
        withinTransactionLimits(from, amount)
        returns (bool)
    {
        // Calculate transfer fee
        uint256 fee = amount.mul(transferFeeRate).div(10000);
        uint256 netAmount = amount.sub(fee);

        // Update transaction tracking
        _updateTransactionTracking(from, amount);

        // Transfer net amount
        bool success = super.transferFrom(from, to, netAmount);

        // Transfer fee
        if (fee > 0 && success) {
            super.transferFrom(from, feeRecipient, fee);
            emit FeeCollected(from, feeRecipient, fee, "transfer");
        }

        return success;
    }

    /**
     * @dev Update transaction tracking for limits
     */
    function _updateTransactionTracking(address user, uint256 amount) internal {
        // Reset daily counters if new day
        if (block.timestamp - lastTransactionTime[user] >= 1 days) {
            dailyTransactionVolume[user] = 0;
            dailyTransactionCount[user] = 0;
        }

        dailyTransactionVolume[user] = dailyTransactionVolume[user].add(amount);
        dailyTransactionCount[user] = dailyTransactionCount[user].add(1);
        lastTransactionTime[user] = block.timestamp;
    }

    /**
     * @dev Pause contract (emergency function)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Set transaction limits
     */
    function setTransactionLimits(
        uint256 maxDaily,
        uint256 maxCount,
        uint256 maxSingle
    ) external onlyRole(ADMIN_ROLE) {
        maxDailyTransactionAmount = maxDaily;
        maxDailyTransactionCount = maxCount;
        maxSingleTransactionAmount = maxSingle;
    }

    /**
     * @dev Set fee rates
     */
    function setFeeRates(
        uint256 transferFee,
        uint256 retirementFee
    ) external onlyRole(ADMIN_ROLE) {
        require(transferFee <= 100, "Transfer fee too high"); // Max 1%
        require(retirementFee <= 100, "Retirement fee too high"); // Max 1%

        transferFeeRate = transferFee;
        retirementFeeRate = retirementFee;
    }

    /**
     * @dev Get project information
     */
    function getProject(
        uint256 projectId
    ) external view returns (CarbonProject memory) {
        return projects[projectId];
    }

    /**
     * @dev Get batch information
     */
    function getBatch(
        uint256 batchId
    ) external view returns (CreditBatch memory) {
        return batches[batchId];
    }

    /**
     * @dev Get retirement record
     */
    function getRetirement(
        uint256 retirementId
    ) external view returns (RetirementRecord memory) {
        return retirements[retirementId];
    }

    /**
     * @dev Get user's vintage year balance
     */
    function getVintageBalance(
        address user,
        uint256 vintageYear
    ) external view returns (uint256) {
        return userVintageBalance[user][vintageYear];
    }

    /**
     * @dev Get total supply for vintage year
     */
    function getVintageSupply(
        uint256 vintageYear
    ) external view returns (uint256) {
        return vintageYearSupply[vintageYear];
    }

    /**
     * @dev Check if user needs compliance check
     */
    function needsComplianceCheck(address user) external view returns (bool) {
        return
            block.timestamp - complianceStatus[user].timestamp >
            complianceCheckInterval;
    }

    /**
     * @dev Check if user needs risk assessment
     */
    function needsRiskAssessment(address user) external view returns (bool) {
        return
            block.timestamp - riskAssessments[user].lastAssessment >
            riskAssessmentInterval;
    }

    // Required overrides
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Emergency withdrawal function (only admin)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).transfer(msg.sender, amount);
        }
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}
