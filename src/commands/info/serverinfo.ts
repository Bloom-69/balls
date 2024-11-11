import { ICommand } from "../../types.js";
import { Logger } from "../../utils/Logger.js";
import { Message } from "revolt.js";

const serverinfo: ICommand = {
    name: "serverinfo",
    description: "Shows information about the current server",
    usage: "serverinfo",
    category: "Info",
    aliases: ["server", "guild"],
    logger: Logger.getInstance("serverinfo"),

    async execute(msg: Message): Promise<void> {
        const server = msg.channel?.server;
        
        if (!server) {
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "This command can only be used in servers!",
                    colour: "#ff0000"
                }]
            });
            return;
        }

        try {
            const owner = await server.fetchMember(server.owner);
            const members = await server.fetchMembers();
            const memberCount = members.members.length;
            const channelCount = Object.keys(server.channels || {}).length;
            const roleCount = Object.keys(server.roles || {}).length;
            const createdAt = new Date(server.createdAt);

            // Format creation date
            const createdDate = createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            await msg.reply({
                embeds: [{
                    title: `📊 Server Information: ${server.name}`,
                    description: [
                        `**Owner:** ${owner?.user?.username || 'Unknown'}`,
                        `**Created:** ${createdDate}`,
                        `**Server ID:** \`${server._id}\``,
                        "",
                        "**Statistics:**",
                        `• Members: ${memberCount}`,
                        `• Channels: ${channelCount}`,
                        `• Roles: ${roleCount}`,
                        "",
                        server.description ? `**Description:**\n${server.description}` : null,
                        "",
                        "**Features:**",
                        `• NSFW: ${server.nsfw ? "Yes" : "No"}`,
                        server.flags ? `• Flags: ${Object.keys(server.flags).join(", ")}` : null
                    ].filter(Boolean).join("\n"),
                    media: server.icon?._id,
                    colour: "#00ff00"
                }]
            });
        } catch (error) {
            this.logger?.error("Error fetching server info:", error);
            await msg.reply({
                embeds: [{
                    title: "Error",
                    description: "Failed to fetch server information",
                    colour: "#ff0000"
                }]
            });
        }
    }
};

export default serverinfo; 