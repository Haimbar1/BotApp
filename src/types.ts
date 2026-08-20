export interface AgentConfig {
  id: string;
  ownerName: string;
  businessName: string;
  ownerPhone: string;
  botId: string;
  whatsappInstance: string;
  businessPrompt: string;
  key: string;
  leadFollowUpDays?: string;
  lastSyncedAt?: string;
  welcomeMessage?: string;
  botIdentity?: string;
  coursesInfo?: string;
  kidsCourses?: string;
  conversationFlow?: string;
  writingStyle?: string;
  faqAnswers?: string;
  whatNotToDo?: string;
  syllabusLinks?: string;
  humanEscalation?: string;
  imagesInfo?: string;
  videosInfo?: string;
  agentEmail?: string;
  status?: string;
  name?: string;
  agentType?: "sales" | "support";
  sendPulseBotId?: string;
  whatsappConfig?: {
    phoneNumberId?: string;
    systemUserAccessToken?: string;
    wabaId?: string;
    phoneNumber?: string;
    code?: string;
    appId?: string;
    status?: string;
    updatedAt?: string;
  };
}

export type MessageSourceType = "whatsapp" | "web" | "facebook" | "unknown";

export interface MessageSourceInfo {
  type: MessageSourceType;
  label: string;
  icon: string;
  badgeClass: string;
}
