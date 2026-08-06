import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { configManager } from '../../config/configManager.js';
import { serverManager } from '../../services/serverManager.js';
import { isServerAdmin } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDMPermission(false)
    .setDescription('Configure bot settings (Servers, Twitch, Permissions).')

    .addSubcommand(sub =>
        sub.setName('show')
           .setDescription('Displays the current bot configuration.')
    )
    
    .addSubcommand(sub =>
        sub.setName('servers')
           .setDescription('Set the Exaroton server IDs (Primary/Proxy first, then backends).')
           .addStringOption(option =>
               option.setName('ids')
                     .setDescription('Server IDs separated by comma (e.g. ID1,ID2,ID3)')
                     .setRequired(true)
           )
    )
    
    .addSubcommand(sub =>
        sub.setName('twitch')
           .setDescription('Set the Twitch channel name to monitor for commands.')
           .addStringOption(option =>
               option.setName('channel')
                     .setDescription('Twitch channel name (e.g. mychannel)')
                     .setRequired(true)
           )
    )
    
    .addSubcommand(sub =>
        sub.setName('twitch-perm')
           .setDescription('Add or remove a required permission level for Twitch commands.')
           .addStringOption(option =>
               option.setName('level')
                     .setDescription('Permission level')
                     .setRequired(true)
                     .addChoices(
                         { name: 'Everyone', value: 'everyone' },
                         { name: 'Subscriber', value: 'subscriber' },
                         { name: 'VIP', value: 'vip' },
                         { name: 'Moderator', value: 'moderator' },
                         { name: 'Broadcaster', value: 'broadcaster' }
                     )
           )
           .addBooleanOption(option =>
               option.setName('allow')
                     .setDescription('True to allow, False to remove this level')
                     .setRequired(true)
           )
    )
    
    .addSubcommand(sub =>
        sub.setName('button-role')
           .setDescription('Assign a role that is allowed to use a specific control button.')
           .addStringOption(option =>
               option.setName('action')
                     .setDescription('Which button action?')
                     .setRequired(true)
                     .addChoices(
                         { name: 'Start', value: 'start' },
                         { name: 'Stop', value: 'stop' },
                         { name: 'Restart', value: 'restart' }
                     )
           )
           .addRoleOption(option =>
               option.setName('role')
                     .setDescription('The Discord role to grant access to')
                     .setRequired(true)
           )
    );

export async function execute(interaction) {
    if (!isServerAdmin(interaction.member)) {
        return interaction.reply({ 
            content: '❌ You do not have permission to use this command.', 
            ephemeral: true 
        });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'show') {
        const serverIds = configManager.getServerIds();
        const twitchChannel = configManager.getTwitchChannel() || '*Not set*';
        const twitchPerms = configManager.getTwitchCommandPermissions().join(', ');
        const buttonPerms = configManager.getButtonPermissions();

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Current Bot Configuration')
            .setColor(0x3498db)
            .addFields(
                { name: '🖥️ Monitored Server IDs', value: serverIds.length > 0 ? serverIds.map((id, index) => `${index === 0 ? 'Primary' : 'Backend'}: \`${id}\``).join('\n') : '*No servers configured*', inline: false },
                { name: '📺 Twitch Channel', value: `\`${twitchChannel}\``, inline: true },
                { name: '🛡️ Twitch Permissions', value: `\`${twitchPerms}\``, inline: true },
                { name: '🕹️ Button Roles', value: `
                    • **Start:** ${buttonPerms.start.map(r => `<@&${r}>`).join(', ') || '*None*'}
                    • **Stop:** ${buttonPerms.stop.map(r => `<@&${r}>`).join(', ') || '*None*'}
                    • **Restart:** ${buttonPerms.restart.map(r => `<@&${r}>`).join(', ') || '*None*'}
                `, inline: false }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'servers') {
        const rawIds = interaction.options.getString('ids');
        const ids = rawIds.split(',').map(id => id.trim()).filter(Boolean);

        configManager.setServerIds(ids);
        serverManager.setServerTargets(ids);

        return interaction.reply({ 
            content: `✅ Successfully updated server targets! Monitoring ${ids.length} server(s).`, 
            ephemeral: true 
        });
    }

    if (subcommand === 'twitch') {
        const channel = interaction.options.getString('channel');
        configManager.setTwitchChannel(channel);

        return interaction.reply({ 
            content: `✅ Twitch channel successfully set to: \`${channel}\``, 
            ephemeral: true 
        });
    }

    if (subcommand === 'twitch-perm') {
        const level = interaction.options.getString('level');
        const allow = interaction.options.getBoolean('allow');

        let currentPerms = configManager.getTwitchCommandPermissions();

        if (allow && !currentPerms.includes(level)) {
            currentPerms.push(level);
        } else if (!allow) {
            currentPerms = currentPerms.filter(l => l !== level);
        }

        configManager.setTwitchCommandPermissions(currentPerms);

        return interaction.reply({ 
            content: `✅ Twitch permissions updated. Allowed levels: \`${currentPerms.join(', ')}\``, 
            ephemeral: true 
        });
    }

    if (subcommand === 'button-role') {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');

        const currentPerms = configManager.getButtonPermissions();
        // Rolle hinzufügen, falls noch nicht in der Liste
        if (!currentPerms[action].includes(role.id)) {
            currentPerms[action].push(role.id);
            configManager.setButtonPermission(action, currentPerms[action]);
        }

        return interaction.reply({ 
            content: `✅ Successfully added role ${role.name} to the allowed list for the **${action}** button.`, 
            ephemeral: true 
        });
    }
}