const {
  Client,
  GatewayIntentBits,
  Events,
  ChannelType,
} = require('discord.js');

const TOKEN = process.env.TOKEN;

const ALONE_TIME_MS = 5 * 60 * 1000; // 5 minutes

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const aloneTimers = new Map();

function countRealUsers(channel) {
  return channel.members.filter(member => !member.user.bot).size;
}

function clearUserTimer(guildId, userId) {
  const key = `${guildId}-${userId}`;
  const timeout = aloneTimers.get(key);
  if (timeout) {
    clearTimeout(timeout);
    aloneTimers.delete(key);
  }
}

function startAloneTimer(member, channel) {
  const { guild, user, voice } = member;
  const key = `${guild.id}-${user.id}`;

  if (aloneTimers.has(key)) return;

  const timeout = setTimeout(async () => {
    aloneTimers.delete(key);

    try {
      const currentChannel = voice.channel;
      if (!currentChannel) return;
      if (currentChannel.id !== channel.id) return;

      if (countRealUsers(currentChannel) === 1) {

        // SEND DM FIRST
        try {
          await user.send(
            "This is Karidas v2 and you've been alone for more than 5 minutes vro sorry zz zz"
          );
        } catch (e) {
          console.log(`Couldn't DM ${user.tag}`);
        }

        // THEN DISCONNECT
        await voice.disconnect();
        console.log(`Disconnected ${user.tag} from ${currentChannel.name}`);
      }

    } catch (error) {
      console.error(`Failed to disconnect ${user.tag}:`, error);
    }
  }, ALONE_TIME_MS);

  aloneTimers.set(key, timeout);
}

function evaluateChannel(channel) {
  if (!channel) return;

  if (
    channel.type !== ChannelType.GuildVoice &&
    channel.type !== ChannelType.GuildStageVoice
  ) return;

  const realMembers = channel.members.filter(member => !member.user.bot);

  if (realMembers.size === 1) {
    const [member] = realMembers.values();
    startAloneTimer(member, channel);
  } else {
    for (const member of realMembers.values()) {
      clearUserTimer(channel.guild.id, member.user.id);
    }
  }
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  for (const guild of readyClient.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (
        channel.type === ChannelType.GuildVoice ||
        channel.type === ChannelType.GuildStageVoice
      ) {
        evaluateChannel(channel);
      }
    }
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const member = newState.member || oldState.member;

  if (!member || member.user.bot) return;

  clearUserTimer(member.guild.id, member.user.id);

  evaluateChannel(oldChannel);
  evaluateChannel(newChannel);
});

client.login(TOKEN);
