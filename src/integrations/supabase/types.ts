export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      campanhas_agendadas: {
        Row: {
          ativo: boolean | null
          base_url: string | null
          canal: string
          created_at: string | null
          dia_semana: number | null
          empr_id: string | null
          filtro_grupo: string | null
          filtro_produto: string | null
          filtro_unem_id: string | null
          horario: string | null
          id: string
          imagem_url: string | null
          mensagem: string
          n8n_webhook_url: string | null
          nome: string
          proxima_execucao: string | null
          recorrencia: string
          tipo: string
          todas_unidades: boolean | null
          total_enviados: number | null
          total_erros: number | null
          ultima_execucao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          base_url?: string | null
          canal?: string
          created_at?: string | null
          dia_semana?: number | null
          empr_id?: string | null
          filtro_grupo?: string | null
          filtro_produto?: string | null
          filtro_unem_id?: string | null
          horario?: string | null
          id?: string
          imagem_url?: string | null
          mensagem?: string
          n8n_webhook_url?: string | null
          nome: string
          proxima_execucao?: string | null
          recorrencia?: string
          tipo?: string
          todas_unidades?: boolean | null
          total_enviados?: number | null
          total_erros?: number | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          base_url?: string | null
          canal?: string
          created_at?: string | null
          dia_semana?: number | null
          empr_id?: string | null
          filtro_grupo?: string | null
          filtro_produto?: string | null
          filtro_unem_id?: string | null
          horario?: string | null
          id?: string
          imagem_url?: string | null
          mensagem?: string
          n8n_webhook_url?: string | null
          nome?: string
          proxima_execucao?: string | null
          recorrencia?: string
          tipo?: string
          todas_unidades?: boolean | null
          total_enviados?: number | null
          total_erros?: number | null
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_etapas: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string
          id: string
          is_ganho: boolean
          is_perdido: boolean
          nome: string
          ordem: number
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id: string
          id?: string
          is_ganho?: boolean
          is_perdido?: boolean
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string
          id?: string
          is_ganho?: boolean
          is_perdido?: boolean
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_oportunidades: {
        Row: {
          canal_origem: string | null
          cliente_id: string | null
          cliente_nome: string | null
          conversa_id: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          empresa_id: string
          etapa_id: string
          fechada_em: string | null
          foto_lead_url: string | null
          ganho: boolean | null
          id: string
          motivo_perda: string | null
          nome_whatsapp: string | null
          ordem: number
          origem: string | null
          probabilidade: number
          telefone: string | null
          titulo: string
          ultimo_contato_em: string | null
          unem_id: string | null
          updated_at: string
          valor_estimado: number
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          canal_origem?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conversa_id?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          empresa_id: string
          etapa_id: string
          fechada_em?: string | null
          foto_lead_url?: string | null
          ganho?: boolean | null
          id?: string
          motivo_perda?: string | null
          nome_whatsapp?: string | null
          ordem?: number
          origem?: string | null
          probabilidade?: number
          telefone?: string | null
          titulo: string
          ultimo_contato_em?: string | null
          unem_id?: string | null
          updated_at?: string
          valor_estimado?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          canal_origem?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          conversa_id?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          empresa_id?: string
          etapa_id?: string
          fechada_em?: string | null
          foto_lead_url?: string | null
          ganho?: boolean | null
          id?: string
          motivo_perda?: string | null
          nome_whatsapp?: string | null
          ordem?: number
          origem?: string | null
          probabilidade?: number
          telefone?: string | null
          titulo?: string
          ultimo_contato_em?: string | null
          unem_id?: string | null
          updated_at?: string
          valor_estimado?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_oportunidades_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "crm_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_timeline: {
        Row: {
          created_at: string
          dados: Json
          descricao: string | null
          empresa_id: string
          id: string
          ocorrido_em: string
          oportunidade_id: string
          tipo: Database["public"]["Enums"]["crm_timeline_tipo"]
          titulo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json
          descricao?: string | null
          empresa_id: string
          id?: string
          ocorrido_em?: string
          oportunidade_id: string
          tipo: Database["public"]["Enums"]["crm_timeline_tipo"]
          titulo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json
          descricao?: string | null
          empresa_id?: string
          id?: string
          ocorrido_em?: string
          oportunidade_id?: string
          tipo?: Database["public"]["Enums"]["crm_timeline_tipo"]
          titulo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_timeline_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_configuracoes: {
        Row: {
          ativo: boolean
          client_token: string | null
          configuracoes: Json
          created_at: string
          empresa_id: string
          id: string
          instance_id: string | null
          numero_whatsapp: string | null
          provedor: Database["public"]["Enums"]["whatsapp_provedor"]
          token_api: string | null
          updated_at: string
          webhook_path: string
          webhook_secret: string
        }
        Insert: {
          ativo?: boolean
          client_token?: string | null
          configuracoes?: Json
          created_at?: string
          empresa_id: string
          id?: string
          instance_id?: string | null
          numero_whatsapp?: string | null
          provedor?: Database["public"]["Enums"]["whatsapp_provedor"]
          token_api?: string | null
          updated_at?: string
          webhook_path?: string
          webhook_secret?: string
        }
        Update: {
          ativo?: boolean
          client_token?: string | null
          configuracoes?: Json
          created_at?: string
          empresa_id?: string
          id?: string
          instance_id?: string | null
          numero_whatsapp?: string | null
          provedor?: Database["public"]["Enums"]["whatsapp_provedor"]
          token_api?: string | null
          updated_at?: string
          webhook_path?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          cliente_id: string | null
          created_at: string
          empresa_id: string
          foto_url: string | null
          ia_ativa: boolean
          ia_pausada_em: string | null
          ia_pausada_por: string | null
          id: string
          nao_lidas: number
          nome_contato: string | null
          oportunidade_id: string | null
          status: Database["public"]["Enums"]["whatsapp_conversa_status"]
          telefone: string
          ultima_direcao:
            | Database["public"]["Enums"]["whatsapp_msg_direcao"]
            | null
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          empresa_id: string
          foto_url?: string | null
          ia_ativa?: boolean
          ia_pausada_em?: string | null
          ia_pausada_por?: string | null
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          oportunidade_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_conversa_status"]
          telefone: string
          ultima_direcao?:
            | Database["public"]["Enums"]["whatsapp_msg_direcao"]
            | null
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string
          foto_url?: string | null
          ia_ativa?: boolean
          ia_pausada_em?: string | null
          ia_pausada_por?: string | null
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          oportunidade_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_conversa_status"]
          telefone?: string
          ultima_direcao?:
            | Database["public"]["Enums"]["whatsapp_msg_direcao"]
            | null
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_ia_config: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[]
          empresa_id: string
          enviar_foto_produto: boolean
          enviar_preco_produto: boolean
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          max_tokens: number
          mensagem_ausencia: string | null
          mensagem_pos_orcamento: string | null
          mensagem_pos_venda: string | null
          modelo: string
          pausar_quando_humano_responder: boolean
          personalidade: string | null
          prompt_personalizado: string | null
          saudacao: string | null
          temperatura: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          empresa_id: string
          enviar_foto_produto?: boolean
          enviar_preco_produto?: boolean
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          max_tokens?: number
          mensagem_ausencia?: string | null
          mensagem_pos_orcamento?: string | null
          mensagem_pos_venda?: string | null
          modelo?: string
          pausar_quando_humano_responder?: boolean
          personalidade?: string | null
          prompt_personalizado?: string | null
          saudacao?: string | null
          temperatura?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          empresa_id?: string
          enviar_foto_produto?: boolean
          enviar_preco_produto?: boolean
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          max_tokens?: number
          mensagem_ausencia?: string | null
          mensagem_pos_orcamento?: string | null
          mensagem_pos_venda?: string | null
          modelo?: string
          pausar_quando_humano_responder?: boolean
          personalidade?: string | null
          prompt_personalizado?: string | null
          saudacao?: string | null
          temperatura?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          conteudo: string | null
          conversa_id: string
          created_at: string
          direcao: Database["public"]["Enums"]["whatsapp_msg_direcao"]
          empresa_id: string
          enviada_em: string
          enviada_por: string | null
          external_id: string | null
          gerada_por_ia: boolean
          id: string
          metadados: Json
          midia_mime: string | null
          midia_nome: string | null
          midia_url: string | null
          reply_to_id: string | null
          status: Database["public"]["Enums"]["whatsapp_msg_status"]
          tipo: Database["public"]["Enums"]["whatsapp_msg_tipo"]
        }
        Insert: {
          conteudo?: string | null
          conversa_id: string
          created_at?: string
          direcao: Database["public"]["Enums"]["whatsapp_msg_direcao"]
          empresa_id: string
          enviada_em?: string
          enviada_por?: string | null
          external_id?: string | null
          gerada_por_ia?: boolean
          id?: string
          metadados?: Json
          midia_mime?: string | null
          midia_nome?: string | null
          midia_url?: string | null
          reply_to_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_msg_status"]
          tipo?: Database["public"]["Enums"]["whatsapp_msg_tipo"]
        }
        Update: {
          conteudo?: string | null
          conversa_id?: string
          created_at?: string
          direcao?: Database["public"]["Enums"]["whatsapp_msg_direcao"]
          empresa_id?: string
          enviada_em?: string
          enviada_por?: string | null
          external_id?: string | null
          gerada_por_ia?: boolean
          id?: string
          metadados?: Json
          midia_mime?: string | null
          midia_nome?: string | null
          midia_url?: string | null
          reply_to_id?: string | null
          status?: Database["public"]["Enums"]["whatsapp_msg_status"]
          tipo?: Database["public"]["Enums"]["whatsapp_msg_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      crm_criar_etapas_padrao: {
        Args: { _empresa_id: string }
        Returns: undefined
      }
      crm_registrar_evento: {
        Args: {
          _dados?: Json
          _descricao?: string
          _empresa_id: string
          _oportunidade_id: string
          _tipo: Database["public"]["Enums"]["crm_timeline_tipo"]
          _titulo: string
          _user_id?: string
        }
        Returns: string
      }
      whatsapp_processar_mensagem_recebida: {
        Args: {
          _conteudo: string
          _empresa_id: string
          _enviada_em: string
          _external_id: string
          _foto_url: string
          _midia_mime: string
          _midia_url: string
          _nome_contato: string
          _telefone: string
          _tipo: Database["public"]["Enums"]["whatsapp_msg_tipo"]
        }
        Returns: Json
      }
    }
    Enums: {
      crm_timeline_tipo:
        | "mensagem"
        | "ligacao"
        | "tarefa"
        | "nota"
        | "etapa"
        | "orcamento"
        | "pedido"
        | "cobranca"
        | "sistema"
      whatsapp_conversa_status: "aberta" | "arquivada" | "resolvida"
      whatsapp_msg_direcao: "recebida" | "enviada"
      whatsapp_msg_status:
        | "pendente"
        | "enviada"
        | "entregue"
        | "lida"
        | "falha"
      whatsapp_msg_tipo:
        | "texto"
        | "imagem"
        | "audio"
        | "video"
        | "documento"
        | "localizacao"
        | "contato"
        | "sticker"
        | "sistema"
      whatsapp_provedor: "zapi" | "evolution" | "meta_cloud" | "apibrasil"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      crm_timeline_tipo: [
        "mensagem",
        "ligacao",
        "tarefa",
        "nota",
        "etapa",
        "orcamento",
        "pedido",
        "cobranca",
        "sistema",
      ],
      whatsapp_conversa_status: ["aberta", "arquivada", "resolvida"],
      whatsapp_msg_direcao: ["recebida", "enviada"],
      whatsapp_msg_status: ["pendente", "enviada", "entregue", "lida", "falha"],
      whatsapp_msg_tipo: [
        "texto",
        "imagem",
        "audio",
        "video",
        "documento",
        "localizacao",
        "contato",
        "sticker",
        "sistema",
      ],
      whatsapp_provedor: ["zapi", "evolution", "meta_cloud", "apibrasil"],
    },
  },
} as const
