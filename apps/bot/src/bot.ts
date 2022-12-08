import { AuthProvider } from '@twitch-apps/auth'
import { IrcClient } from '@twitch-apps/irc'
import { PrismaClient } from '@twitch-apps/prisma'
import { ApiClient } from '@twurple/api'
import { ChatUserstate } from '@twurple/auth-tmi/lib/index.js'
import { ChatMessage } from './chat/index.js'
import { ChatterState } from './chat/types.js'
import { Client } from './client.js'
import { CommandParser } from './commands/model/parser.js'
import { config } from './config.js'
import { scopes } from './constants.js'

export class Bot {
  private prismaClient: PrismaClient
  private authProvider: AuthProvider
  private ircClient: IrcClient
  private apiClient: ApiClient
  private client: Client

  async connect(): Promise<void> {
    this.prismaClient = new PrismaClient()
    await this.prismaClient.$connect()

    const tokens = await AuthProvider.getTokens(this.prismaClient)
    this.authProvider = new AuthProvider({
      prismaClient: this.prismaClient,
      clientId: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      initialToken: tokens
        ? {
            ...tokens,
            obtainmentTimestamp: tokens.obtainmentTimestamp.getTime()
          }
        : {
            accessToken: config.ACCESS_TOKEN,
            refreshToken: config.REFRESH_TOKEN,
            expiresIn: 1,
            obtainmentTimestamp: 0,
            scope: scopes
          }
    })

    this.apiClient = new ApiClient({
      authProvider: this.authProvider
    })

    const botInfo = await this.apiClient.users.getMe()

    this.ircClient = new IrcClient(this.authProvider, botInfo.displayName)

    this.client = new Client(this.ircClient, this.apiClient, this.prismaClient)

    await this.ircClient.connect()

    this.ircClient.on('message', this.onMessage.bind(this))
  }

  private async onMessage(
    channel: string,
    userstate: ChatUserstate,
    messageText: string,
    self: boolean
  ): Promise<void> {
    if (self) return

    const chatter = { ...userstate, message: messageText } as ChatterState
    const msg = new ChatMessage(this.client, chatter, channel)

    if (msg.author.username === this.ircClient.getUsername()) {
      if (
        !(
          msg.author.isBroadcaster ||
          msg.author.isModerator ||
          msg.author.isVip
        )
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    const res = CommandParser.parse(messageText)
    if (res) {
      console.log(res)
    }
  }
}
