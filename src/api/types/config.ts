/**
 * Configuration Static settings
 * @interface ConfigStatic
 */
export interface ConfigStatic {
  root_path: string
  root_log_level: string
  app_title: string
  app_summary: string
  app_description: string
  app_debug: boolean
  app_version: string
  app_host: string
  app_port: number
  app_log_level: string
  queue_max_size: number
  queue_get_timeout: number
  queue_sleep_timeout: number
  db_log_level: string
  db_timeout: number
  db_base_dir: string
  db_file_name: string
  db_table_prefix: string
  db_save_batch_size: number
  db_save_batch_timeout: number
  attempts_limit: number
  req_connection_retries: number
  req_timeout_default: number
  req_timeout_connect: number
  req_timeout_read: number
  req_max_connections: number
  req_max_keepalive_connections: number
  req_ssl_verify: boolean
  req_default_limit: number
  domains_filtered_min_len: number
  domains_update_interval: number
  domain_resolve_semaphore_limit: number
  domains_black_list: string
  lists_update_interval_sec: number
  ip_not_allowed: string
  ros_rest_api_read_timeout: number
}

/**
 * Configuration Dynamic settings
 * @interface ConfigDynamic
 */
export interface ConfigDynamic {
  ip_not_allowed_list: string[]
  app_title_metrics: string
  db_path: string
  db_connection: string
}

/**
 * Configuration Response
 * @interface ConfigResponse
 */
export interface ConfigResponse {
  static: ConfigStatic
  dynamic: ConfigDynamic
}
