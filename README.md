# Minecraft Exaroton Manager Bot

A robust, self-healing bot to manage Minecraft servers hosted on [Exaroton](https://exaroton.com/:en/) via Discord and Twitch. The bot features real-time WebSocket synchronization, automated status embeddings, and graceful error handling.

## Features
- **Real-time Synchronization:** Uses WebSockets to instantly update server status.
- **Multi-Server Support:** Control a proxy/main server while monitoring backend servers.
- **Twitch Integration:** Let trusted Twitch viewers start the server via chat commands.
- **Self-Healing & Outage Protection:** Gracefully handles API/Cloudflare outages without crashing. The embed visually indicates API errors (greyed out) and auto-recovers.
- **Discord Slash Commands:** Fully configurable without touching code or JSON files directly.

---

## Prerequisites
* **Linux Environment:** This guide and the provided PM2 setup are exclusively designed for Linux (e.g., Ubuntu, Debian). Windows is not officially supported.
* **Node.js** (v18 or higher recommended)
* **npm** (Node Package Manager)
* **PM2** (Process Manager for production deployment)
* An **Exaroton Account** with an API token
* A **Discord Application** (Bot) created via the [Discord Developer Portal](https://discord.com/developers/applications)

---

## Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/Bzvzn/exaroton_custom_bot.git
cd exaroton_custom_bot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Rename the ```.env.example``` file to ```.env``` and add your secret tokens.

1. **Exaroton Token:**
    - Go to your [Exaroton Account Settings](https://exaroton.com/account/settings/) and create an API token.
    - Copy it and add it to the ```.env``` file.

    > Note: The account creating the token needs to have access to the server.

2. **Discord Token:**
    - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    - Select your application and navigate to the Bot tab. Click ```Reset Token``` and copy the newly created token into the ```.env``` file.
    - Generate an OAuth2 invite URL under the OAuth2 > URL Generator tab:
        - Scopes: ```bot```, ```applications.commands```
        - Bot Permissions: Select the necessary permissions (```Send Messages```, ```Embed Links```, ```Read Message History```) directly in the generator checklist.
    - Copy the generated URL and use it to invite the bot to your Discord server.

### 4. Running the bot with PM2
Use PM2 to ensure the bot runs continuously and restarts automatically on errors.
*(Note: These background process commands are intended for Linux servers.)*


1. **Start the bot using the ecosystem config:**
    ```bash
    pm2 start ecosystem.config.cjs
    ```

2. **Save the PM2 process list so it survives system reboots:**
    ```bash
    pm2 save
    pm2 startup
    ```

**Useful PM2 commands:**
- View live logs with timestamps: ```pm2 logs mc-server-manager```
- Restart the bot: ```pm2 restart mc-server-manager```
- Stop the bot: ```pm2 stop mc-server-manager```
- Check bot status and resources: ```pm2 status```

### 5. Bot Configuration
Most of the bot is controlled directly via slash commands in Discord.

#### Server Setup
```/config servers [ID1, ID2, ...]```

Adds the minecraft servers the bot should monitor.

- ```ID1``` is required and represents the Primary Server (Proxy or only game server). The bot only controls this server.
- All subsequent IDs are optional backend/game servers. The bot will only display their status.

> Note: The server ID is shown under the Server Name in Exaroton (e.g., ```#abc123xyz```). Entering it with or without the ```#``` works.

#### Twitch Integration (Optional)

```/config twitch [channel]```

Links a Twitch channel to listen for the startup command.

- Only 1 Twitch channel is supported at a time.
- The default command is ```!startmc``` (this can be changed in ```config.json```).

<br>

```/config twitch-perm [role] [allow]```

Configures which Twitch user types are allowed to trigger the command (e.g., ```subscriber``` or ```vip```).

> Note: By default, only the broadcaster and moderators can use the command. The bot does not send feedback in the Twitch chat.

#### Discord Permissions

```/config button-role [action] [role] [allow]```

Sets permissions for who can use the Start/Stop/Restart buttons on the embed.

> Note: Administrators and users with the ```Manage Server``` permission can use all buttons by default.

#### Maintenance and Overview

```/config maintenance [enabled]```

Disables server control via the Discord embed buttons and Twitch chat. The embed updates visually to indicate maintenance mode.

<br>

```/config show```

Displays an overview of your current bot configuration (linked servers, permissions, etc.).

### 6. Creating the status embed

```/setup```

Run this command in the desired Discord channel. The bot will post the control embed and automatically update it in real time from then on.

## Updating the Bot
To update the bot to the newest version, simply navigate to your bot's folder and pull the latest changes from GitHub:
```bash
git pull
npm install
pm2 restart mc-server-manager
```

## Troubleshooting
- **The Embed is grey / Buttons are disabled:** This happens when the Exaroton API is temporarily unreachable (e.g., Cloudflare outages). The bot is still running and will automatically reconnect and update the embed once the API is back online.
- **Slash commands are not showing up:** Re-invite the bot with the correct OAuth2 link or wait a few minutes for Discord to register the global commands.

## FAQ & Beginner Tips

* **Can I run this on Windows?**
    While the Node.js code itself might run on Windows, this project and its documentation are optimized for Linux servers (VPS or Raspberry Pi). There is no official support or guide for Windows deployment.
* **The `/setup` command doesn't do anything!**
    Make sure the bot actually has the permissions to view and send messages in the channel where you are trying to use the command.
* **My bot crashes immediately and says "Token Invalid" or "Missing Token".**
    Check your `.env` file.
* **Why is the bot offline when I turn off my PC?**
    The bot only runs as long as the machine hosting it is turned on. For 24/7 uptime, rent a cheap Linux VPS or use a Raspberry Pi.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.