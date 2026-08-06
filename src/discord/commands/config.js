import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { configManager } from '../../config/configManager.js';
import { serverManager } from '../../services/serverManager.js';
import { isServerAdmin } from '../utils/permissions.js';
import { startTwitchBot, stopTwitchBot } from '../../twitch/twitchClient.js';

export const data = new SlashCommandBuilder()
    .setName('config')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription('Configure bot settings (Servers, Twitch, Permissions).')

    .addSubcommand(sub =>
        sub.setName('show')
            .setDescription('Displays the current bot configuration.')
    )

    .addSubcommand(sub =>
        sub.setName('maintenance')
            .setDescription('Enable or disable maintenance mode (blocks server start/stop via bot).')
            .addBooleanOption(option =>
                option.setName('enabled')
                    .setDescription('True to enable, False to disable')
                    .setRequired(true)
            )
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
            .addBooleanOption(option =>
                option.setName('allow')
                    .setDescription('True to grant access, False to remove access')
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    if (!isServerAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral 
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
                {
                    name: '🕹️ Button Roles', value: `
                    • **Start:** ${buttonPerms.start.map(r => `<@&${r}>`).join(', ') || '*None*'}
                    • **Stop:** ${buttonPerms.stop.map(r => `<@&${r}>`).join(', ') || '*None*'}
                    • **Restart:** ${buttonPerms.restart.map(r => `<@&${r}>`).join(', ') || '*None*'}
                `, inline: false
                },
                { name: '🔧 Maintenance', value: configManager.isMaintenanceMode() ? '🔴 Enabled' : '🟢 Disabled', inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral  });
    }

    if (subcommand === 'maintenance') {
        const enabled = interaction.options.getBoolean('enabled');
        configManager.setMaintenanceMode(enabled);

        serverManager.emit('targetsChanged');

        if (enabled) {
            return interaction.reply({
                content: '🔧 **Maintenance Mode ENABLED!** The server cannot be controlled via buttons or Twitch until disabled.',
                flags: MessageFlags.Ephemeral 
            });
        } else {
            return interaction.reply({
                content: '✅ **Maintenance Mode DISABLED!** Server control via buttons and Twitch is active again.',
                flags: MessageFlags.Ephemeral 
            });
        }
    }

    if (subcommand === 'servers') {
        const rawIds = interaction.options.getString('ids');
        let ids = rawIds.split(',').map(id => id.replace(/#/g, '').trim()).filter(Boolean);

        if (ids.length === 1 && (ids[0].toLowerCase() === 'clear' || ids[0].toLowerCase() === 'none')) {
            await serverManager.setServerTargets([]);
            configManager.setServerIds([]);

            return interaction.reply({
                content: '✅ All monitored servers have been cleared!',
                flags: MessageFlags.Ephemeral
            });
        }

        const validIds = await serverManager.setServerTargets(ids);

        if (validIds.length === 0) {
            return interaction.reply({ 
                content: '❌ **Error:** None of the provided server IDs are valid on Exaroton. Nothing was changed.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        if (validIds.length < ids.length) {
            configManager.setServerIds(validIds);
            return interaction.reply({ 
                content: `⚠️ **Warning:** Some server IDs were invalid and ignored. Successfully monitoring ${validIds.length} valid server(s).`, 
                flags: MessageFlags.Ephemeral 
            });
        }

        configManager.setServerIds(validIds);

        return interaction.reply({ 
            content: `✅ Successfully updated server targets! Monitoring ${validIds.length} server(s).`, 
            flags: MessageFlags.Ephemeral 
        });
    }

    if (subcommand === 'twitch') {
        const channel = interaction.options.getString('channel');
        configManager.setTwitchChannel(channel);

        await stopTwitchBot();
        await startTwitchBot();

        return interaction.reply({
            content: `✅ Twitch channel successfully set to: \`${channel}\``,
            flags: MessageFlags.Ephemeral 
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
            flags: MessageFlags.Ephemeral 
        });
    }

    if (subcommand === 'button-role') {
        const action = interaction.options.getString('action');
        const role = interaction.options.getRole('role');
        const allow = interaction.options.getBoolean('allow');

        const currentPerms = configManager.getButtonPermissions();

        if (allow) {
            if (!currentPerms[action].includes(role.id)) {
                currentPerms[action].push(role.id);
                configManager.setButtonPermission(action, currentPerms[action]);
            }
            return interaction.reply({
                content: `✅ Successfully added role ${role.name} to the allowed list for the **${action}** button.`,
                flags: MessageFlags.Ephemeral 
            });
        } else {
            currentPerms[action] = currentPerms[action].filter(id => id !== role.id);
            configManager.setButtonPermission(action, currentPerms[action]);
            return interaction.reply({
                content: `✅ Successfully removed role ${role.name} from the allowed list for the **${action}** button.`,
                flags: MessageFlags.Ephemeral 
            });
        }
    }
}