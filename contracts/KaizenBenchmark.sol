// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract KaizenBenchmark {
    address public owner;

    struct ScoreEvent {
        bytes32 userId;
        uint8 previousScore;
        uint8 newScore;
        string reason;
        uint256 timestamp;
    }

    struct PatternEvent {
        bytes32 userId;
        string patternType;
        string severity;
        uint256 timestamp;
    }

    struct MilestoneEvent {
        bytes32 userId;
        string milestoneType;
        uint8 scoreAtMilestone;
        uint256 timestamp;
    }

    ScoreEvent[] public scoreEvents;
    PatternEvent[] public patternEvents;
    MilestoneEvent[] public milestoneEvents;

    mapping(bytes32 => uint256) public userSessionCount;
    mapping(bytes32 => uint8) public userCurrentScore;
    mapping(bytes32 => uint256) public userMilestoneCount;

    event ScoreChanged(
        bytes32 indexed userId,
        uint8 previousScore,
        uint8 newScore,
        string reason,
        uint256 timestamp
    );

    event PatternDetected(
        bytes32 indexed userId,
        string patternType,
        string severity,
        uint256 timestamp
    );

    event MilestoneReached(
        bytes32 indexed userId,
        string milestoneType,
        uint8 score,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordScoreChange(
        bytes32 userId,
        uint8 previousScore,
        uint8 newScore,
        string memory reason
    ) external onlyOwner {
        scoreEvents.push(ScoreEvent({
            userId: userId,
            previousScore: previousScore,
            newScore: newScore,
            reason: reason,
            timestamp: block.timestamp
        }));

        userCurrentScore[userId] = newScore;
        userSessionCount[userId]++;

        emit ScoreChanged(userId, previousScore, newScore, reason, block.timestamp);
    }

    function recordPattern(
        bytes32 userId,
        string memory patternType,
        string memory severity
    ) external onlyOwner {
        patternEvents.push(PatternEvent({
            userId: userId,
            patternType: patternType,
            severity: severity,
            timestamp: block.timestamp
        }));

        emit PatternDetected(userId, patternType, severity, block.timestamp);
    }

    function recordMilestone(
        bytes32 userId,
        string memory milestoneType,
        uint8 score
    ) external onlyOwner {
        milestoneEvents.push(MilestoneEvent({
            userId: userId,
            milestoneType: milestoneType,
            scoreAtMilestone: score,
            timestamp: block.timestamp
        }));

        userMilestoneCount[userId]++;
        emit MilestoneReached(userId, milestoneType, score, block.timestamp);
    }

    function getUserStats(bytes32 userId) external view returns (
        uint8 currentScore,
        uint256 sessionCount,
        uint256 milestoneCount
    ) {
        return (
            userCurrentScore[userId],
            userSessionCount[userId],
            userMilestoneCount[userId]
        );
    }

    function getTotalEvents() external view returns (
        uint256 scores,
        uint256 patterns,
        uint256 milestones
    ) {
        return (
            scoreEvents.length,
            patternEvents.length,
            milestoneEvents.length
        );
    }
}
