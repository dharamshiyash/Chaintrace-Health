// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainTraceHealth
 * @notice Blockchain-backed medicine batch traceability with point-of-divergence detection.
 *         Every custody change is recorded on-chain with an `authorized` flag computed
 *         at write time against the previous custodian's approved-partner whitelist.
 *         Status flips automatically to Suspicious on the first unauthorized handoff.
 */
contract ChainTraceHealth {

    // ─────────────────────────────────────────────────────────────
    // Enums & Structs
    // ─────────────────────────────────────────────────────────────

    enum Status { Active, Suspicious, Recalled, Expired, Unknown }

    struct SupplyChainEvent {
        address actor;
        string  role;       // "Manufacturer" | "Distributor" | "Pharmacy"
        uint256 timestamp;
        string  location;
        bool    authorized;
    }

    struct Batch {
        string   medicineName;
        string   batchId;
        uint256  manufacturingDate;
        uint256  expiryDate;
        uint256  quantity;
        address  manufacturer;
        Status   status;
        string   recallReason;
        bool     exists;
        SupplyChainEvent[] history;
    }

    // ─────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────

    // batchIdHash => Batch
    mapping(bytes32 => Batch) private _batches;

    // All registered batch hashes (for iteration in aggregation)
    bytes32[] private _allBatchHashes;

    // manufacturer => (partner => approved)
    mapping(address => mapping(address => bool)) private _approvedPartners;

    // manufacturer => list of approved partner addresses (for enumeration)
    mapping(address => address[]) private _partnerList;

    // ─────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────

    event BatchRegistered(
        bytes32 indexed batchIdHash,
        string  batchId,
        string  medicineName,
        address indexed manufacturer,
        uint256 expiryDate
    );

    event SupplyChainEventAdded(
        bytes32 indexed batchIdHash,
        address indexed actor,
        string  role,
        bool    authorized,
        uint256 timestamp
    );

    event BatchRecalled(
        bytes32 indexed batchIdHash,
        string  reason,
        address indexed recalledBy
    );

    event PartnerAdded(
        address indexed manufacturer,
        address indexed partner
    );

    event PartnerRemoved(
        address indexed manufacturer,
        address indexed partner
    );

    // ─────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────

    modifier batchExists(bytes32 batchIdHash) {
        require(_batches[batchIdHash].exists, "Batch does not exist");
        _;
    }

    modifier onlyManufacturer(bytes32 batchIdHash) {
        require(
            _batches[batchIdHash].manufacturer == msg.sender,
            "Only the batch manufacturer can call this"
        );
        _;
    }

    // ─────────────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Register a new medicine batch on-chain.
     * @dev The first SupplyChainEvent is created automatically with the manufacturer as actor.
     */
    function registerBatch(
        string calldata batchId,
        string calldata medicineName,
        uint256 manufacturingDate,
        uint256 expiryDate,
        uint256 quantity,
        string calldata initialLocation
    ) external {
        require(bytes(batchId).length > 0, "Batch ID required");
        require(bytes(medicineName).length > 0, "Medicine name required");
        require(manufacturingDate < expiryDate, "Manufacturing date must be before expiry");
        require(quantity > 0, "Quantity must be positive");

        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(!_batches[batchIdHash].exists, "Batch ID already registered");

        Batch storage b = _batches[batchIdHash];
        b.medicineName      = medicineName;
        b.batchId           = batchId;
        b.manufacturingDate = manufacturingDate;
        b.expiryDate        = expiryDate;
        b.quantity          = quantity;
        b.manufacturer      = msg.sender;
        b.status            = Status.Active;
        b.recallReason      = "";
        b.exists            = true;

        // Genesis event: manufacturer creates the batch
        b.history.push(SupplyChainEvent({
            actor:      msg.sender,
            role:       "Manufacturer",
            timestamp:  block.timestamp,
            location:   initialLocation,
            authorized: true   // manufacturer is always authorized for genesis
        }));

        _allBatchHashes.push(batchIdHash);

        emit BatchRegistered(batchIdHash, batchId, medicineName, msg.sender, expiryDate);
        emit SupplyChainEventAdded(batchIdHash, msg.sender, "Manufacturer", true, block.timestamp);
    }

    /**
     * @notice Add a supply chain custody event.
     * @dev Authorization is computed at write time: the caller must be in the previous
     *      custodian's approved-partner whitelist. If not, `authorized` is stored as false
     *      and status flips to Suspicious.
     */
    function addSupplyChainEvent(
        string calldata batchId,
        string calldata role,
        string calldata location
    ) external {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(_batches[batchIdHash].exists, "Batch does not exist");
        
        Batch storage b = _batches[batchIdHash];
        require(b.status != Status.Recalled, "Cannot add events to a recalled batch");
        require(bytes(role).length > 0, "Role required");
        require(bytes(location).length > 0, "Location required");

        // Previous custodian is the actor in the last event
        address prevCustodian = b.history[b.history.length - 1].actor;

        // Authorization check: caller must be in previous custodian's approved-partner list
        bool isAuthorized = _approvedPartners[prevCustodian][msg.sender];

        b.history.push(SupplyChainEvent({
            actor:      msg.sender,
            role:       role,
            timestamp:  block.timestamp,
            location:   location,
            authorized: isAuthorized
        }));

        // Auto-flip to Suspicious on first unauthorized handoff
        if (!isAuthorized && b.status == Status.Active) {
            b.status = Status.Suspicious;
        }

        emit SupplyChainEventAdded(batchIdHash, msg.sender, role, isAuthorized, block.timestamp);
    }

    /**
     * @notice Recall a batch with a mandatory reason.
     * @param reason One of: "Confirmed Expiry" | "Probable Expiry" | "Quality Defect" |
     *               "Contamination" | "Other"
     */
    function recallBatch(
        string calldata batchId,
        string calldata reason
    ) external {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(_batches[batchIdHash].exists, "Batch does not exist");
        require(
            _batches[batchIdHash].manufacturer == msg.sender,
            "Only the batch manufacturer can recall"
        );
        require(bytes(reason).length > 0, "Recall reason required");

        _batches[batchIdHash].status      = Status.Recalled;
        _batches[batchIdHash].recallReason = reason;

        emit BatchRecalled(batchIdHash, reason, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────
    // Whitelist Management
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Add an address to the caller's approved-partner whitelist.
     */
    function addApprovedPartner(address partner) external {
        require(partner != address(0), "Invalid partner address");
        require(partner != msg.sender, "Cannot approve self");
        require(!_approvedPartners[msg.sender][partner], "Already approved");

        _approvedPartners[msg.sender][partner] = true;
        _partnerList[msg.sender].push(partner);

        emit PartnerAdded(msg.sender, partner);
    }

    /**
     * @notice Remove an address from the caller's approved-partner whitelist.
     */
    function removeApprovedPartner(address partner) external {
        require(_approvedPartners[msg.sender][partner], "Not an approved partner");

        _approvedPartners[msg.sender][partner] = false;

        // Remove from list (swap-and-pop)
        address[] storage list = _partnerList[msg.sender];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == partner) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }

        emit PartnerRemoved(msg.sender, partner);
    }

    /**
     * @notice Check if a partner is approved by a given manufacturer/custodian.
     */
    function isApprovedPartner(address custodian, address partner) external view returns (bool) {
        return _approvedPartners[custodian][partner];
    }

    /**
     * @notice Get all approved partners for the caller.
     */
    function getApprovedPartners(address custodian) external view returns (address[] memory) {
        return _partnerList[custodian];
    }

    // ─────────────────────────────────────────────────────────────
    // Read Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Read-only status and metadata check for a batch.
     */
    function verifyBatch(string calldata batchId) external view returns (
        bool   exists,
        string memory medicineName,
        string memory bId,
        uint256 manufacturingDate,
        uint256 expiryDate,
        uint256 quantity,
        address manufacturer,
        Status  status,
        string memory recallReason
    ) {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        Batch storage b = _batches[batchIdHash];
        return (
            b.exists,
            b.medicineName,
            b.batchId,
            b.manufacturingDate,
            b.expiryDate,
            b.quantity,
            b.manufacturer,
            b.status,
            b.recallReason
        );
    }

    /**
     * @notice Returns the full event history for a batch.
     */
    function getBatchHistory(string calldata batchId) external view returns (
        SupplyChainEvent[] memory
    ) {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(_batches[batchIdHash].exists, "Batch does not exist");
        return _batches[batchIdHash].history;
    }

    /**
     * @notice For a Suspicious batch, returns the last authorized custodian and
     *         the first unauthorized recipient — the exact point of divergence.
     * @return lastAuthorized  Address of the last actor with authorized=true
     * @return firstUnauthorized Address of the first actor with authorized=false
     * Returns (address(0), address(0)) if no divergence exists.
     */
    function getDivergencePoint(string calldata batchId) external view returns (
        address lastAuthorized,
        address firstUnauthorized
    ) {
        bytes32 batchIdHash = keccak256(abi.encodePacked(batchId));
        require(_batches[batchIdHash].exists, "Batch does not exist");

        SupplyChainEvent[] storage history = _batches[batchIdHash].history;
        
        for (uint256 i = 1; i < history.length; i++) {
            if (!history[i].authorized) {
                return (history[i - 1].actor, history[i].actor);
            }
        }
        return (address(0), address(0));
    }

    /**
     * @notice Returns all registered batch hashes (for off-chain aggregation).
     */
    function getAllBatchHashes() external view returns (bytes32[] memory) {
        return _allBatchHashes;
    }

    /**
     * @notice Returns total number of registered batches.
     */
    function getBatchCount() external view returns (uint256) {
        return _allBatchHashes.length;
    }

    /**
     * @notice Returns the current status of a batch by hash (for aggregation).
     */
    function getBatchStatusByHash(bytes32 batchIdHash) external view returns (Status) {
        require(_batches[batchIdHash].exists, "Batch does not exist");
        return _batches[batchIdHash].status;
    }

    /**
     * @notice Divergence point lookup by hash (for aggregation without knowing batchId string).
     */
    function getDivergencePointByHash(bytes32 batchIdHash) external view returns (
        address lastAuthorized,
        address firstUnauthorized
    ) {
        require(_batches[batchIdHash].exists, "Batch does not exist");

        SupplyChainEvent[] storage history = _batches[batchIdHash].history;
        
        for (uint256 i = 1; i < history.length; i++) {
            if (!history[i].authorized) {
                return (history[i - 1].actor, history[i].actor);
            }
        }
        return (address(0), address(0));
    }
}
