import { PermissionsBitField } from 'discord.js';
import { configManager } from '../../config/configManager.js';


/**
 * Evaluates whether a Discord guild member possesses administrative privileges.
 * Verifies if the user has either the `Administrator` or `ManageGuild` permission flags.
 * Used for securing administrative commands such as `/setup` and `/config`.
 * 
 * @param {GuildMember|null|undefined} member - The Discord GuildMember instance to check.
 * @returns {boolean} True if member exists and holds administrative permissions; false otherwise.
 */
export function isServerAdmin(member) {
    if (!member) return false;

    // Checks for either global Administrator rights or Guild Management permissions
    return member.permissions.has(PermissionsBitField.Flags.Administrator) || 
           member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}


/**
 * Determines whether a Discord guild member is authorized to interact with a server control UI button.
 * - **Administrators:** Automatically granted full access bypassing role restrictions.
 * - **Regular Users:** Must hold at least one Discord Role ID assigned to the action in database configuration.
 * 
 * @param {GuildMember|null|undefined} member - The Discord GuildMember instance to evaluate.
 * @param {'start'|'stop'|'restart'} action - The button action type requested by the user.
 * @returns {boolean} True if authorized to execute the action; false otherwise.
 */
export function canUseButton(member, action) {
    if (!member) return false;

    // Administrative override check
    if (isServerAdmin(member)) return true;

    const permissions = configManager.getButtonPermissions();
    const allowedRoles = permissions[action] || [];

    // Validates if member has any matching configured role
    return member.roles.cache.some(role => allowedRoles.includes(role.id));
}