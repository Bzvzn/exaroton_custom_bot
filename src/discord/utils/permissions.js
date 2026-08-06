import { PermissionsBitField } from 'discord.js';
import { configManager } from '../../config/configManager.js';


/**
 * Checks if a user has basic Administrator or Server Manager rights.
 * Used for strict commands like /setup or /config.
 * 
 * @param {import('discord.js').GuildMember} member - The Discord member object.
 * @returns {boolean} True if the member is an admin.
 */
export function isServerAdmin(member) {
    if (!member) return false;

    // Default: User braucht "Administrator" oder "Server verwalten"
    return member.permissions.has(PermissionsBitField.Flags.Administrator) || 
           member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

/**
 * Checks if a user is allowed to press a specific server control button.
 * Admins are always allowed. Regular users need a role that is saved in the database.
 * 
 * @param {import('discord.js').GuildMember} member - The Discord member object.
 * @param {'start'|'stop'|'restart'} action - The action the user is trying to perform.
 * @returns {boolean} True if allowed, false otherwise.
 */
export function canUseButton(member, action) {
    if (!member) return false;

    if (isServerAdmin(member)) return true;

    const permissions = configManager.getButtonPermissions();
    const allowedRoles = permissions[action] || [];

    return member.roles.cache.some(role => allowedRoles.includes(role.id));
}