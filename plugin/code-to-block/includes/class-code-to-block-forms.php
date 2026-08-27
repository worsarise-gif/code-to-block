<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Native form handling: storage, validation, spam defenses (server-side only).
 *
 * Honeypot, minimum-fill-time, rate limit, and logging are all enforced in PHP
 * even if client-side JS also exists — client is decoration, not security.
 */
final class Code_To_Block_Forms {
	const TABLE_SUBMISSIONS = 'code_to_block_submissions';
	const TABLE_LOGS = 'code_to_block_submission_logs';
	const MIN_FILL_SECONDS = 2;
	const RATE_LIMIT_SECONDS = 30;
	const RATE_LIMIT_MAX = 1;
	const DB_VERSION = '1';
	const DB_VERSION_OPTION = 'code_to_block_forms_db_version';
	const MAX_FIELD_BYTES = 10000;

	public static function maybe_upgrade() {
		if ( self::DB_VERSION !== get_option( self::DB_VERSION_OPTION ) ) {
			self::install();
		}
	}

	public static function install() {
		global $wpdb;
		$table = $wpdb->prefix . self::TABLE_SUBMISSIONS;
		$logs = $wpdb->prefix . self::TABLE_LOGS;
		$charset = $wpdb->get_charset_collate();
		$sql = "CREATE TABLE $table (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL,
			form_id varchar(191) NOT NULL,
			data longtext NOT NULL,
			ip varchar(100) NOT NULL,
			user_agent text NOT NULL,
			created_at datetime NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'new',
			PRIMARY KEY  (id),
			KEY post_id (post_id),
			KEY created_at (created_at)
		) $charset;";
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
		$sql2 = "CREATE TABLE $logs (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			post_id bigint(20) unsigned NOT NULL,
			form_id varchar(191) NOT NULL,
			ip varchar(100) NOT NULL,
			reason varchar(191) NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY ip_created (ip,created_at)
		) $charset;";
		dbDelta( $sql2 );
		update_option( self::DB_VERSION_OPTION, self::DB_VERSION, false );
	}

	public static function create_submission_token( $post_id, $form_id, $timestamp ) {
		$payload = (int) $post_id . '|' . (string) $form_id . '|' . (int) $timestamp;
		return hash_hmac( 'sha256', $payload, wp_salt( 'nonce' ) );
	}

	public static function log_rejection( $post_id, $form_id, $ip, $reason ) {
		global $wpdb;
		$logs = $wpdb->prefix . self::TABLE_LOGS;
		$wpdb->insert( $logs, array(
			'post_id' => (int) $post_id,
			'form_id' => sanitize_text_field( $form_id ),
			'ip' => sanitize_text_field( $ip ),
			'reason' => sanitize_text_field( $reason ),
			'created_at' => current_time( 'mysql', true ),
		), array( '%d', '%s', '%s', '%s', '%s' ) );
	}

	public static function handle_submit( $request ) {
		$post_id = (int) $request['post_id'];
		$post = get_post( $post_id );
		if ( ! $post || CODE_TO_BLOCK_POST_TYPE !== $post->post_type ) {
			return new WP_Error( 'code_to_block_form_not_found', 'Form page not found.', array( 'status' => 404 ) );
		}
		$document = code_to_block_get_saved_document( $post_id );
		if ( null === $document ) {
			return new WP_Error( 'code_to_block_form_no_doc', 'No form document.', array( 'status' => 404 ) );
		}
		$params = $request->get_params();
		// Also support JSON body
		$json = $request->get_json_params();
		if ( is_array( $json ) && ! empty( $json ) ) {
			$params = array_merge( $params, $json );
		}
		$form_id = isset( $params['_ctb_form_id'] ) ? sanitize_text_field( $params['_ctb_form_id'] ) : '';
		if ( '' === $form_id ) {
			return new WP_Error( 'code_to_block_form_missing_id', 'Missing form ID.', array( 'status' => 400 ) );
		}
		// Find form block
		$form_block = self::find_form_block( $document['root'], $form_id );
		if ( ! $form_block ) {
			return new WP_Error( 'code_to_block_form_not_found_block', 'Form block not found.', array( 'status' => 404 ) );
		}
		// Check submission handling: if external, reject native submit
		$submission = isset( $form_block['attributes']['data-submission'] ) ? $form_block['attributes']['data-submission'] : 'native';
		if ( 'external' === $submission ) {
			return new WP_Error( 'code_to_block_form_external', 'This form uses external handling.', array( 'status' => 400 ) );
		}
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( $_SERVER['REMOTE_ADDR'] ) : '0.0.0.0';
		$now = time();

		// Spam: honeypot (server-side, silent fake success if filled)
		$hp_name = '_ctb_hp_' . substr( md5( $form_id ), 0, 8 );
		if ( ! array_key_exists( $hp_name, $params ) || '' !== trim( (string) $params[ $hp_name ] ) ) {
			self::log_rejection( $post_id, $form_id, $ip, 'honeypot' );
			// Fake success to not inform bot
			return new WP_REST_Response( array( 'success' => true, 'message' => 'Thanks! Your submission was received.' ), 200 );
		}
		// Also check generic honeypot names
		foreach ( $params as $k => $v ) {
			if ( 0 === strpos( $k, '_ctb_hp_' ) && '' !== trim( $v ) ) {
				self::log_rejection( $post_id, $form_id, $ip, 'honeypot_generic' );
				return new WP_REST_Response( array( 'success' => true, 'message' => 'Thanks! Your submission was received.' ), 200 );
			}
		}
		// Spam: minimum fill time
		$ts = isset( $params['_ctb_timestamp'] ) ? (int) $params['_ctb_timestamp'] : 0;
		$token = isset( $params['_ctb_submission_token'] ) ? sanitize_text_field( $params['_ctb_submission_token'] ) : '';
		$expected_token = self::create_submission_token( $post_id, $form_id, $ts );
		if ( ! $ts || $ts > $now || ( $now - $ts ) > DAY_IN_SECONDS || ! hash_equals( $expected_token, $token ) ) {
			self::log_rejection( $post_id, $form_id, $ip, 'invalid_timing_token' );
			return new WP_Error( 'code_to_block_form_invalid_timing', 'The form session expired. Please reload and try again.', array( 'status' => 400 ) );
		}
		if ( ( $now - $ts ) < self::MIN_FILL_SECONDS ) {
			self::log_rejection( $post_id, $form_id, $ip, 'too_fast' );
			return new WP_Error( 'code_to_block_form_too_fast', 'Submission too fast. Please wait a moment and try again.', array( 'status' => 400 ) );
		}
		// Spam: rate limiting per IP using atomic transients to prevent DB race conditions
		$rate_limit_key = 'ctb_rl_' . md5( $ip );
		$requests = (int) get_transient( $rate_limit_key );
		if ( $requests >= self::RATE_LIMIT_MAX ) {
			self::log_rejection( $post_id, $form_id, $ip, 'rate_limit' );
			return new WP_Error( 'code_to_block_form_rate_limit', 'Too many submissions. Please wait 30 seconds.', array( 'status' => 429 ) );
		}
		set_transient( $rate_limit_key, $requests + 1, self::RATE_LIMIT_SECONDS );


		// Validation: iterate form fields
		$fields = self::collect_fields( $form_block );
		$errors = array();
		$data = array();
		foreach ( $fields as $field ) {
			$attrs = isset( $field['attributes'] ) ? $field['attributes'] : array();
			$name = isset( $attrs['data-field-name'] ) ? $attrs['data-field-name'] : $field['id'];
			$label = isset( $attrs['data-field-label'] ) ? $attrs['data-field-label'] : $name;
			$type = isset( $attrs['data-field-type'] ) ? $attrs['data-field-type'] : 'text';
			$required = ! empty( $attrs['data-field-required'] );
			
			if ( 'file' === $type ) {
				$file_upload = isset( $_FILES[ $name ] ) ? $_FILES[ $name ] : null;
				if ( $required && ( ! $file_upload || $file_upload['error'] === UPLOAD_ERR_NO_FILE ) ) {
					$errors[ $name ] = sprintf( '%s is required.', $label );
					continue;
				}
				if ( $file_upload && $file_upload['error'] !== UPLOAD_ERR_NO_FILE ) {
					if ( $file_upload['error'] !== UPLOAD_ERR_OK ) {
						$errors[ $name ] = sprintf( '%s failed to upload.', $label );
						continue;
					}
					if ( $file_upload['size'] > 5 * 1024 * 1024 ) { // 5MB limit
						$errors[ $name ] = sprintf( '%s must be under 5MB.', $label );
						continue;
					}
					// Check mime type securely using WP functions
					$wp_filetype = wp_check_filetype_and_ext( $file_upload['tmp_name'], $file_upload['name'] );
					if ( ! $wp_filetype['ext'] || ! wp_match_mime_types( 'image,document,pdf', $wp_filetype['type'] ) ) {
						$errors[ $name ] = sprintf( '%s is an invalid file type.', $label );
						continue;
					}
					$data[ $name ] = $file_upload; // Temporarily store array to process later
				}
				continue;
			}
			
			$value = isset( $params[ $name ] ) ? $params[ $name ] : '';
			if ( is_array( $value ) ) {
				if ( count( $value ) > 100 ) {
					$errors[ $name ] = sprintf( '%s contains too many values.', $label );
					continue;
				}
				$value = array_map( 'sanitize_text_field', $value );
				$joined = implode( ', ', $value );
			} else {
				$value = 'textarea' === $type ? sanitize_textarea_field( $value ) : sanitize_text_field( $value );
				$joined = $value;
			}
			if ( strlen( $joined ) > self::MAX_FIELD_BYTES ) {
				$errors[ $name ] = sprintf( '%s is too long.', $label );
				continue;
			}
			if ( $required && '' === trim( $joined ) ) {
				$errors[ $name ] = sprintf( '%s is required.', $label );
				continue;
			}
			if ( '' !== trim( $joined ) ) {
				if ( 'email' === $type && ! is_email( $joined ) ) {
					$errors[ $name ] = sprintf( '%s must be a valid email.', $label );
					continue;
				}
				if ( 'url' === $type && ! filter_var( $joined, FILTER_VALIDATE_URL ) ) {
					$errors[ $name ] = sprintf( '%s must be a valid URL.', $label );
					continue;
				}
				if ( 'number' === $type && ! is_numeric( $joined ) ) {
					$errors[ $name ] = sprintf( '%s must be a number.', $label );
					continue;
				}
				if ( in_array( $type, array( 'select', 'radio', 'checkbox' ), true ) ) {
					$allowed_options = isset( $attrs['data-field-options'] ) ? array_filter( array_map( 'trim', explode( ',', $attrs['data-field-options'] ) ) ) : array();
					$submitted_options = is_array( $value ) ? $value : array( $value );
					if ( empty( $allowed_options ) || array_diff( $submitted_options, $allowed_options ) ) {
						$errors[ $name ] = sprintf( '%s contains an invalid option.', $label );
						continue;
					}
				}
			}
			$data[ $name ] = $joined;
		}
		if ( ! empty( $errors ) ) {
			return new WP_Error( 'code_to_block_form_validation', 'Validation failed.', array( 'status' => 400, 'errors' => $errors ) );
		}

		// Handle file uploads now that validation passed
		require_once ABSPATH . 'wp-admin/includes/file.php';
		$attachments = array();
		foreach ( $data as $k => $v ) {
			if ( is_array( $v ) && isset( $v['tmp_name'] ) ) {
				$upload_overrides = array( 'test_form' => false );
				$movefile = wp_handle_upload( $v, $upload_overrides );
				if ( $movefile && ! isset( $movefile['error'] ) ) {
					$data[ $k ] = $movefile['url']; // Store URL in DB
					$attachments[] = $movefile['file']; // For wp_mail
				} else {
					$data[ $k ] = 'Upload failed: ' . ( isset( $movefile['error'] ) ? $movefile['error'] : 'Unknown error' );
				}
			}
		}

		// Store submission
		$stored = $wpdb->insert( $table, array(
			'post_id' => $post_id,
			'form_id' => $form_id,
			'data' => wp_json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
			'ip' => $ip,
			'user_agent' => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ) : '',
			'created_at' => current_time( 'mysql', true ),
			'status' => 'new',
		), array( '%d', '%s', '%s', '%s', '%s', '%s', '%s' ) );
		if ( false === $stored ) {
			return new WP_Error( 'code_to_block_form_storage_failed', 'The submission could not be stored. Please try again.', array( 'status' => 500 ) );
		}
		$submission_id = $wpdb->insert_id;

		// Email notification
		$email_to = isset( $form_block['attributes']['data-email-to'] ) ? $form_block['attributes']['data-email-to'] : get_option( 'admin_email' );
		$email_to = sanitize_email( $email_to ) ? $email_to : get_option( 'admin_email' );
		$subject = sprintf( 'New form submission from %s', get_the_title( $post_id ) );
		$body = "New submission for form {$form_id} on " . get_permalink( $post_id ) . "\n\n";
		foreach ( $data as $k => $v ) {
			$body .= $k . ': ' . $v . "\n";
		}
		$body .= "\nIP: {$ip}\nTime: " . current_time( 'mysql' ) . "\nSubmission ID: {$submission_id}\n";
		$email_sent = wp_mail( $email_to, $subject, $body, '', $attachments );
		if ( ! $email_sent ) {
			error_log( sprintf( 'Code to Block form email failed for submission %d.', $submission_id ) );
		}

		return new WP_REST_Response( array( 'success' => true, 'message' => 'Thanks! Your submission was received.', 'id' => $submission_id, 'email_sent' => (bool) $email_sent ), 200 );
	}

	private static function find_form_block( $block, $form_id ) {
		if ( isset( $block['id'] ) && $block['id'] === $form_id && 'form' === $block['type'] ) {
			return $block;
		}
		foreach ( $block['children'] as $child ) {
			if ( isset( $child['kind'] ) ) continue;
			$found = self::find_form_block( $child, $form_id );
			if ( $found ) return $found;
		}
		return null;
	}

	private static function collect_fields( $form_block ) {
		$fields = array();
		foreach ( $form_block['children'] as $child ) {
			if ( isset( $child['kind'] ) ) continue;
			if ( 'form_field' === $child['type'] ) {
				$fields[] = $child;
			} else {
				// Recurse for nested containers inside form
				$nested = self::collect_fields( $child );
				$fields = array_merge( $fields, $nested );
			}
		}
		return $fields;
	}

	public static function admin_menu() {
		add_submenu_page(
			'edit.php?post_type=' . CODE_TO_BLOCK_POST_TYPE,
			'Form Submissions',
			'Submissions',
			'manage_options',
			'code-to-block-submissions',
			array( __CLASS__, 'render_admin' )
		);
	}

	public static function render_admin() {
		if ( ! current_user_can( 'manage_options' ) ) return;
		global $wpdb;
		$table = $wpdb->prefix . self::TABLE_SUBMISSIONS;
		$logs = $wpdb->prefix . self::TABLE_LOGS;
		// Handle actions
		if ( isset( $_GET['action'] ) && isset( $_GET['id'] ) && check_admin_referer( 'ctb_submission_' . $_GET['id'] ) ) {
			$id = (int) $_GET['id'];
			if ( 'mark_read' === $_GET['action'] ) {
				$wpdb->update( $table, array( 'status' => 'read' ), array( 'id' => $id ), array( '%s' ), array( '%d' ) );
			} elseif ( 'mark_spam' === $_GET['action'] ) {
				$wpdb->update( $table, array( 'status' => 'spam' ), array( 'id' => $id ), array( '%s' ), array( '%d' ) );
			} elseif ( 'delete' === $_GET['action'] ) {
				$wpdb->delete( $table, array( 'id' => $id ), array( '%d' ) );
			}
		}
		$submissions = $wpdb->get_results( "SELECT * FROM $table ORDER BY created_at DESC LIMIT 100", ARRAY_A );
		$recent_logs = $wpdb->get_results( "SELECT * FROM $logs ORDER BY created_at DESC LIMIT 50", ARRAY_A );
		echo '<div class="wrap"><h1>Code to Block Submissions</h1>';
		echo '<p>Native form submissions and recent spam rejections (server-side enforced). Client-side is decoration, not security.</p>';
		echo '<h2>Submissions (100 recent)</h2><table class="widefat"><thead><tr><th>ID</th><th>Post</th><th>Form</th><th>Data</th><th>IP</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
		if ( $submissions ) {
			foreach ( $submissions as $row ) {
				$data = json_decode( $row['data'], true );
				$data_str = $data ? esc_html( implode( ', ', array_map( function($k,$v){ return "$k: $v"; }, array_keys($data), $data ) ) ) : esc_html( $row['data'] );
				echo '<tr><td>' . (int) $row['id'] . '</td><td>' . (int) $row['post_id'] . '</td><td>' . esc_html( $row['form_id'] ) . '</td><td>' . $data_str . '</td><td>' . esc_html( $row['ip'] ) . '</td><td>' . esc_html( $row['created_at'] ) . '</td><td>' . esc_html( $row['status'] ) . '</td><td>';
				echo '<a href="' . esc_url( wp_nonce_url( admin_url( 'edit.php?post_type=' . CODE_TO_BLOCK_POST_TYPE . '&page=code-to-block-submissions&action=mark_read&id=' . $row['id'] ), 'ctb_submission_' . $row['id'] ) ) . '">Read</a> | ';
				echo '<a href="' . esc_url( wp_nonce_url( admin_url( 'edit.php?post_type=' . CODE_TO_BLOCK_POST_TYPE . '&page=code-to-block-submissions&action=mark_spam&id=' . $row['id'] ), 'ctb_submission_' . $row['id'] ) ) . '">Spam</a> | ';
				echo '<a href="' . esc_url( wp_nonce_url( admin_url( 'edit.php?post_type=' . CODE_TO_BLOCK_POST_TYPE . '&page=code-to-block-submissions&action=delete&id=' . $row['id'] ), 'ctb_submission_' . $row['id'] ) ) . '">Delete</a>';
				echo '</td></tr>';
			}
		} else {
			echo '<tr><td colspan="8">No submissions yet.</td></tr>';
		}
		echo '</tbody></table>';
		echo '<h2>Recent rejections (spam log, 50 recent)</h2><table class="widefat"><thead><tr><th>Time</th><th>Post</th><th>Form</th><th>IP</th><th>Reason</th></tr></thead><tbody>';
		if ( $recent_logs ) {
			foreach ( $recent_logs as $row ) {
				echo '<tr><td>' . esc_html( $row['created_at'] ) . '</td><td>' . (int) $row['post_id'] . '</td><td>' . esc_html( $row['form_id'] ) . '</td><td>' . esc_html( $row['ip'] ) . '</td><td>' . esc_html( $row['reason'] ) . '</td></tr>';
			}
		} else {
			echo '<tr><td colspan="5">No rejections logged.</td></tr>';
		}
		echo '</tbody></table></div>';
	}
}
