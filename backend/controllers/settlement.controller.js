import Group from "../models/group.model.js";
import Expense from "../models/expense.model.js";
import User from "../models/user.model.js";
import { convertToUSD, convertCurrency } from "../services/currency.service.js";
import Settlement from "../models/settlement.model.js";

const calculateMinimumTransactions = (balances) => {
    const transactions = [];
    const balanceArray = Object.entries(balances).map(([userId, amount]) => ({
        userId,
        amount
    }));

    const creditors = balanceArray.filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount);
    const debtors = balanceArray.filter(b => b.amount < 0).sort((a, b) => a.amount - b.amount);

    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        const settleAmount = Math.min(creditor.amount, Math.abs(debtor.amount));

        if (settleAmount > 0.01) {
            transactions.push({
                from: debtor.userId,
                to: creditor.userId,
                amountUSD: parseFloat(settleAmount.toFixed(2))
            });
        }

        creditor.amount -= settleAmount;
        debtor.amount += settleAmount;

        if (creditor.amount < 0.01) i++;
        if (Math.abs(debtor.amount) < 0.01) j++;
    }

    return transactions;
};

export const generateSettlementPlan = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const groupData = await Group.findById(groupId).lean();
        if (!groupData) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = groupData.members.some(
            memberId => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ 
                message: "You are not authorized to view this group's settlement plan" 
            });
        }

        const expenses = await Expense.find({ 
            group: groupId,
            splitType: { $ne: "none" }
        }).lean();

        if (expenses.length === 0) {
            return res.status(200).json({
                message: "No expenses to settle",
                groupId: groupId,
                groupName: groupData.name,
                totalExpenses: 0,
                balances: {},
                settlements: []
            });
        }

        const users = await User.find({ 
            _id: { $in: groupData.members } 
        }).select('_id name email preferredCurrency').lean();

        const userMap = {};
        users.forEach(user => {
            userMap[user._id.toString()] = {
                id: user._id,
                name: user.name,
                email: user.email,
                preferredCurrency: user.preferredCurrency || "USD"
            };
        });

        const balancesUSD = {};

        groupData.members.forEach(memberId => {
            balancesUSD[memberId.toString()] = 0;
        });

        expenses.forEach(expense => {
            const paidById = expense.paidBy.toString();
            
            const amountInUSD = convertToUSD(expense.amount, expense.currency);
            
            balancesUSD[paidById] = (balancesUSD[paidById] || 0) + amountInUSD;

            if (expense.splitDetails && expense.splitDetails.length > 0) {
                expense.splitDetails.forEach(split => {
                    const splitUserId = split.user.toString();
                    const shareAmount = split.amount || 0;
                    const shareInUSD = convertToUSD(shareAmount, expense.currency);
                    balancesUSD[splitUserId] = (balancesUSD[splitUserId] || 0) - shareInUSD;
                });
            }
        });

        const settlementsUSD = calculateMinimumTransactions(balancesUSD);

        const enrichedSettlements = settlementsUSD.map(settlement => {
            const fromUser = userMap[settlement.from];
            const toUser = userMap[settlement.to];

            // Safety check - skip if users not found
            if (!fromUser || !toUser) {
                return null;
            }

            const amountInFromCurrency = convertCurrency(
                settlement.amountUSD, 
                'USD', 
                fromUser.preferredCurrency || 'USD'
            );
            const amountInToCurrency = convertCurrency(
                settlement.amountUSD, 
                'USD', 
                toUser.preferredCurrency || 'USD'
            );

            return {
                from: {
                    user: {
                        id: fromUser.id,
                        name: fromUser.name,
                        email: fromUser.email
                    },
                    amount: amountInFromCurrency,
                    currency: fromUser.preferredCurrency || 'USD'
                },
                to: {
                    user: {
                        id: toUser.id,
                        name: toUser.name,
                        email: toUser.email
                    },
                    amount: amountInToCurrency,
                    currency: toUser.preferredCurrency || 'USD'
                },
                amountUSD: settlement.amountUSD,
                description: `${fromUser.name} pays ${toUser.name}`
            };
        }).filter(Boolean); // Remove null entries

        const balanceSummary = {};
        
        Object.entries(balancesUSD).forEach(([userId, balanceUSD]) => {
            if (Math.abs(balanceUSD) > 0.01) {
                const user = userMap[userId];
                if (user) {
                    const balanceInPreferredCurrency = convertCurrency(
                        Math.abs(balanceUSD),
                        'USD',
                        user.preferredCurrency
                    );

                    balanceSummary[userId] = {
                        user: user,
                        balanceUSD: parseFloat(balanceUSD.toFixed(2)),
                        balance: balanceInPreferredCurrency,
                        currency: user.preferredCurrency,
                        status: balanceUSD > 0 ? "owed" : "owes"
                    };
                }
            }
        });

        const totalExpenseUSD = expenses.reduce((sum, exp) => {
            return sum + convertToUSD(exp.amount, exp.currency);
        }, 0);

        return res.status(200).json({
            message: "Settlement plan generated successfully",
            groupId: groupId,
            groupName: groupData.name,
            totalExpenses: expenses.length,
            totalAmountUSD: parseFloat(totalExpenseUSD.toFixed(2)),
            baseCurrency: "USD",
            balances: balanceSummary,
            settlements: enrichedSettlements,
            transactionCount: enrichedSettlements.length,
            note: "All calculations are done in USD, but amounts are shown in each user's preferred currency"
        });

    } catch (error) {
        console.error("Error generating settlement plan:", error);
        return res.status(500).json({ message: error.message });
    }
};

export const getSettlementHistory = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const groupData = await Group.findById(groupId).lean();
        if (!groupData) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = groupData.members.some(
            memberId => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ 
                message: "You are not authorized to view this group's settlement history" 
            });
        }

        const settlements = await Settlement.find({ 
            group: groupId 
        }).lean();

        return res.status(200).json({
            message: "Settlement history retrieved successfully",
            groupId: groupId,
            groupName: groupData.name,
            settlements: settlements
        });
    } catch (error) {
        console.error("Error retrieving settlement history:", error);
        return res.status(500).json({ message: error.message });
    }
};

export const verifySettlement = async (req, res) => {
    try {
        const { groupId, settlementId } = req.params;
        const userId = req.user._id;
        const { notes } = req.body || {};

        const groupData = await Group.findById(groupId).lean();
        if (!groupData) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = groupData.members.some(
            memberId => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ 
                message: "You are not authorized to verify settlements in this group" 
            });
        }

        const settlement = await Settlement.findById(settlementId);
        if (!settlement) {
            return res.status(404).json({ message: "Settlement not found" });
        }

        if (settlement.group.toString() !== groupId) {
            return res.status(400).json({ 
                message: "Settlement does not belong to this group" 
            });
        }

        const isFromUser = settlement.from.toString() === userId.toString();
        const isToUser = settlement.to.toString() === userId.toString();

        if (!isFromUser && !isToUser) {
            return res.status(403).json({ 
                message: "Only the payer or receiver can verify this settlement" 
            });
        }

        if (settlement.status === "completed") {
            return res.status(400).json({ 
                message: "Settlement is already completed" 
            });
        }

        settlement.status = "verified";
        settlement.verifiedBy = userId;
        settlement.verifiedAt = new Date();
        if (notes) {
            settlement.notes = notes;
        }

        await settlement.save();

        return res.status(200).json({
            message: "Settlement verified successfully",
            settlement: {
                id: settlement._id,
                from: settlement.from,
                to: settlement.to,
                amount: settlement.amount,
                currency: settlement.currency,
                status: settlement.status,
                verifiedBy: settlement.verifiedBy,
                verifiedAt: settlement.verifiedAt,
                notes: settlement.notes
            }
        });
    } catch (error) {
        console.error("Error verifying settlement:", error);
        return res.status(500).json({ message: error.message });
    }
};

export const recordSettlement = async (req, res) => {
    try {
        const { groupId, settlementId } = req.params;
        const userId = req.user._id;

        const groupData = await Group.findById(groupId).lean();
        if (!groupData) {
            return res.status(404).json({ message: "Group not found" });
        }

        const isMember = groupData.members.some(
            memberId => memberId.toString() === userId.toString()
        );
        if (!isMember) {
            return res.status(403).json({ 
                message: "You are not authorized to record settlements in this group" 
            });
        }

        const settlement = await Settlement.findById(settlementId);
        if (!settlement) {
            return res.status(404).json({ message: "Settlement not found" });
        }

        if (settlement.group.toString() !== groupId) {
            return res.status(400).json({ 
                message: "Settlement does not belong to this group" 
            });
        }

        // Only the receiver (to) can mark settlement as completed
        const isReceiver = settlement.to.toString() === userId.toString();
        if (!isReceiver) {
            return res.status(403).json({ 
                message: "Only the receiver can mark this settlement as completed" 
            });
        }

        if (settlement.status !== "verified") {
            return res.status(400).json({ 
                message: "Settlement must be verified before it can be completed" 
            });
        }

        settlement.status = "completed";
        settlement.completedAt = new Date();

        await settlement.save();

        return res.status(200).json({
            message: "Settlement recorded successfully",
            settlement: {
                id: settlement._id,
                from: settlement.from,
                to: settlement.to,
                amount: settlement.amount,
                currency: settlement.currency,
                status: settlement.status,
                completedAt: settlement.completedAt
            }
        });
    } catch (error) {
        console.error("Error recording settlement:", error);
        return res.status(500).json({ message: error.message });
    }
};