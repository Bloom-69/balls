import { ICommand } from "../../types.js";
import { mainLogger } from "../../utils/Logger.js";
import { DatabaseService } from "../../services/DatabaseService.js";

const VOTE_DURATION = 60000; // 60 seconds
const REQUIRED_VOTES_PERCENTAGE = 0.5; // 50% of online members

const votekick: ICommand = {
    name: "votekick",
    description: "Starts a votekick for a user",
    usage: "votekick <userId> <reason>",
    category: "Moderation",

    async execute(msg, args) {
        const db = DatabaseService.getInstance();
        const serverId = msg.channel?.server?._id;
        
        // Check if moderation is enabled
        const config = await db.getServerConfig(serverId || '');
        if (!config.features.experiments.moderation) {
            return msg.reply({
                embeds: [{
                    title: "Feature Disabled",
                    description: "Moderation commands are disabled on this server",
                    colour: "#ff0000"
                }]
            });
        }

        if (!args || args.length < 2) {
            return msg.reply({
                embeds: [{
                    title: "Invalid Usage",
                    description: "Please provide a user ID and reason",
                    colour: "#ff0000"
                }]
            });
        }

        try {
            const db = DatabaseService.getInstance();
            const serverConfig = await db.getServerConfig(msg.channel?.server?._id ?? '');

            // Check if user is blocked
            if (serverConfig.security.blockedUsers.includes(msg.author?._id ?? '')) {
                return msg.reply({
                    embeds: [{
                        title: "Access Denied",
                        description: "You are blocked from using this command",
                        colour: "#ff0000"
                    }]
                });
            }

            // Try to fetch the member first
            let targetMember;
            try {
                const members = await msg.channel?.server?.fetchMembers();
                targetMember = members?.members.find(member => {
                    // Clean up the search term and username for comparison
                    const searchTerm = args[0].trim();
                    const username = member.user?.username?.trim();

                    return member._id.user === searchTerm || // Exact ID match
                        (username && username.toLowerCase() === searchTerm.toLowerCase()); // Case-insensitive username match
                });
            } catch (error) {
                mainLogger.error("Error fetching members:", error);
            }

            if (!targetMember) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "User not found in this server. Please provide a valid user ID or username.",
                        colour: "#ff0000"
                    }]
                });
            }

            // Check if user is a bot through the user object
            if (targetMember.user?.bot) {
                return msg.reply({
                    embeds: [{
                        title: "Error",
                        description: "Cannot votekick a bot",
                        colour: "#ff0000"
                    }]
                });
            }

            const reason = args.slice(1).join(" ").trim();
            const voteMessage = await msg.reply({
                embeds: [{
                    title: "Votekick Started",
                    description: [
                        `A votekick has been started against **${targetMember.user?.username}**`,
                        `**Reason**: ${reason}`,
                        `**Started by**: ${msg.author?.username}`,
                        "\nReact with \u2705 to vote YES",
                        "React with \u274C to vote NO",
                        `\nVote ends in ${VOTE_DURATION / 1000} seconds`
                    ].join("\n"),
                    colour: "#ffff00"
                }]
            });

            if (!voteMessage) {
                throw new Error("Failed to create vote message");
            }

            // Add reactions with error handling
            try {
                await Promise.all([
                    voteMessage.react(encodeURIComponent("\u2705")),
                    voteMessage.react(encodeURIComponent("\u274C"))
                ]);
            } catch (error) {
                mainLogger.error("Failed to add vote reactions:", error);
                await msg.reply("Failed to start vote due to reaction error");
                return;
            }

            // Wait for votes with timeout
            await Promise.race([
                new Promise(resolve => setTimeout(resolve, VOTE_DURATION)),
                new Promise((_, reject) => setTimeout(() =>
                    reject(new Error("Vote timed out")), VOTE_DURATION + 1000))
            ]);

            // Get final vote counts
            const message = await msg.channel?.fetchMessage(voteMessage._id);
            if (!message) throw new Error("Could not fetch vote message");

            // Get reactions using Unicode
            const yesReaction = message.reactions?.get(encodeURIComponent("\u2705"));
            const noReaction = message.reactions?.get(encodeURIComponent("\u274C"));

            const yesVotes = yesReaction?.size || 0;
            const noVotes = noReaction?.size || 0;

            // Calculate if votekick passes using members collection size
            const memberCount: number | undefined = (await msg.channel?.server?.fetchMembers())?.members.length;
            if (!memberCount) throw new Error("Failed to fetch member count");
            const requiredVotes = Math.ceil(memberCount * REQUIRED_VOTES_PERCENTAGE);
            const votekickPasses = yesVotes > noVotes && yesVotes >= requiredVotes;

            if (votekickPasses) {
                try {
                    await targetMember.kick();
                    return msg.reply({
                        embeds: [{
                            title: "Votekick Successful",
                            description: [
                                `**${targetMember.user?.username}** has been kicked`,
                                `**Final Votes**: Yes: ${yesVotes}, No: ${noVotes} (Total: ${yesVotes + noVotes})`,
                                `**Reason**: ${reason}`
                            ].join("\n"),
                            colour: "#00ff00"
                        }]
                    });
                } catch (error) {
                    mainLogger.error("Failed to kick user after successful votekick:", error);
                    return msg.reply({
                        embeds: [{
                            title: "Error",
                            description: "Votekick passed but failed to kick user. Make sure I have the required permissions.",
                            colour: "#ff0000"
                        }]
                    });
                }
            } else {
                return msg.reply({
                    embeds: [{
                        title: "Votekick Failed",
                        description: [
                            `Not enough votes to kick **${targetMember.user?.username}**`,
                            `**Final Votes**: Yes: ${yesVotes}, No: ${noVotes} (Total: ${yesVotes + noVotes})`,
                            `**Required Votes**: ${requiredVotes}`
                        ].join("\n"),
                        colour: "#ff0000"
                    }]
                });
            }
        } catch (error) {
            mainLogger.error("Error in votekick command:", error);
            return msg.reply({
                embeds: [{
                    title: "Error",
                    description: `An error occurred while executing the votekick\n \`\`\`\n${error}\n\`\`\``,
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default votekick;