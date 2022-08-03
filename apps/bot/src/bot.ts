import { AuthProvider } from '@twitch-apps/auth'
import { PrismaClient } from '@twitch-apps/prisma'
import { ApiClient } from '@twurple/api'
import { ChatClient } from '@twurple/chat'
import { Api } from './api.js'
import { Chat } from './chat.js'
import { Vips } from './commands/vips.js'
import { config } from './config.js'
import { scopes } from './constants/index.js'
import { CoreClient } from './core.js'
import { parseMessage } from './utils/parse-message.js'

export class Bot {
  private prismaClient: PrismaClient
  private authProvider: AuthProvider
  private chatClient: ChatClient
  private apiClient: ApiClient
  private coreClient: CoreClient

  constructor() {}

  async connect(): Promise<void> {
    this.prismaClient = new PrismaClient()
    await this.prismaClient.$connect()

    const tokens = await AuthProvider.getTokens(this.prismaClient)
    this.authProvider = new AuthProvider({
      prismaClient: this.prismaClient,
      clientId: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      initialToken: tokens ?? {
        accessToken: config.ACCESS_TOKEN,
        refreshToken: config.REFRESH_TOKEN,
        expiresIn: 1,
        obtainmentTimestamp: 0,
        scope: scopes
      }
    })

    this.apiClient = new Api(this.authProvider)
    this.chatClient = new Chat(this.authProvider, 'vs_code')
    this.coreClient = new CoreClient(this.chatClient, this.apiClient)

    const vips = new Vips(this.coreClient)

    this.chatClient.onMessage((channel, user, message, msg) => {
      const parsedMessage = parseMessage(message)

      if (parsedMessage) {
        if (parsedMessage.command === vips.options.name) {
          vips.execute(msg, parsedMessage.args)
        }
      }

      console.log(`${user}:`, message)
    })

    await this.chatClient.connect()
  }
}
