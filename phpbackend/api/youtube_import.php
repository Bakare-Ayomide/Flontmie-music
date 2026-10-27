<?php
/**
 * Flontmie API - External Catalog Import Endpoint (Disabled)
 * External YouTube Music API / iTunes preview imports are completely disabled.
 * Strictly Admin, Distributor, Label, and Artist direct master uploads are permitted.
 */

require_once __DIR__ . '/../config.php';

json_response([
    'status' => 'error',
    'message' => 'External YouTube Music API and public catalog imports are disabled. Only Admin and Distributor direct file uploads are permitted.'
], 410);
