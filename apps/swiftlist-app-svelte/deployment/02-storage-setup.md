# SwiftList Storage Bucket Configuration

## Overview
SwiftList uses Supabase Storage for handling job uploads and processed assets with proper access controls.

## Buckets Required

### 1. job-uploads (Public Read, Authenticated Write)
Stores original images uploaded by users for job processing.

### 2. job-outputs (Public Read, Authenticated Write)
Stores processed images and results from AI workflows.

## Deployment Commands

### Option A: Using Supabase Dashboard (Recommended for First Setup)

1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets
2. Click "New bucket"
3. Configure as follows:

**Bucket 1: job-uploads**
- Name: `job-uploads`
- Public bucket: ✅ Yes
- File size limit: 10 MB
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`

**Bucket 2: job-outputs**
- Name: `job-outputs`
- Public bucket: ✅ Yes
- File size limit: 50 MB
- Allowed MIME types: `image/jpeg,image/jpg,image/png,image/webp`

### Option B: Using SQL

```sql
-- Create job-uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-uploads',
  'job-uploads',
  true,
  10485760, -- 10 MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Create job-outputs bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-outputs',
  'job-outputs',
  true,
  52428800, -- 50 MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);
```

## Storage Policies (RLS)

### job-uploads Policies

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own uploads
CREATE POLICY "Users can view own uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read for processed images (after job completion)
CREATE POLICY "Public can view uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-uploads');

-- Allow service role to update/delete
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'job-uploads')
WITH CHECK (bucket_id = 'job-uploads');
```

### job-outputs Policies

```sql
-- Allow n8n service to write outputs
CREATE POLICY "Service role can upload outputs"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'job-outputs');

-- Allow users to view outputs linked to their jobs
CREATE POLICY "Users can view own outputs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'job-outputs');

-- Allow public read for sharing
CREATE POLICY "Public can view outputs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'job-outputs');
```

## Deployment Steps

### Step 1: Create Buckets
Execute SQL commands above in Supabase SQL Editor.

### Step 2: Verify Buckets

```sql
-- List all buckets
SELECT * FROM storage.buckets;

-- Expected output: job-uploads and job-outputs buckets
```

### Step 3: Test Upload (Optional)

```bash
# Using Supabase CLI
supabase storage cp test-image.jpg supabase://job-uploads/test-user-id/test.jpg

# Verify upload
supabase storage ls supabase://job-uploads/test-user-id/
```

### Step 4: Configure CORS (If Using Custom Domain)

In Supabase Dashboard > Settings > API:

```json
{
  "origins": [
    "https://swiftlist.app",
    "https://www.swiftlist.app",
    "http://localhost:5173"
  ],
  "methods": ["GET", "POST", "PUT", "DELETE"],
  "allowedHeaders": ["authorization", "x-client-info", "apikey", "content-type"]
}
```

## Folder Structure Convention

```
job-uploads/
  └── {user_id}/
      └── {timestamp}-{random}.{ext}

job-outputs/
  └── {job_id}/
      ├── original.jpg
      ├── processed.png
      └── metadata.json
```

## File Naming Convention

### Uploads
```
{user_id}/{Date.now()}-{random(7)}.{extension}
Example: abc123/1705123456789-x7k9m2p.jpg
```

### Outputs
```
{job_id}/{filename}
Example: 550e8400-e29b-41d4-a716-446655440000/result.png
```

## Monitoring and Cleanup

### Check Storage Usage

```sql
-- Total storage used
SELECT
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint / 1024 / 1024 as size_mb
FROM storage.objects
GROUP BY bucket_id;
```

### Cleanup Old Files (Optional)

```sql
-- Delete uploads older than 30 days
DELETE FROM storage.objects
WHERE bucket_id = 'job-uploads'
  AND created_at < NOW() - INTERVAL '30 days';
```

## Security Best Practices

1. ✅ **User Isolation**: Files stored in user-specific folders
2. ✅ **Public Access**: Read-only for sharing processed results
3. ✅ **Size Limits**: Prevent abuse with file size restrictions
4. ✅ **MIME Type Validation**: Only allow image formats
5. ✅ **Service Role Access**: n8n can write outputs via service key

## Troubleshooting

### Error: "new row violates row-level security policy"
- Ensure user is authenticated
- Verify user_id matches auth.uid()
- Check RLS policies are correctly applied

### Error: "file size exceeds limit"
- Check file_size_limit in storage.buckets
- Resize images before upload if needed

### Files Not Accessible
- Verify bucket is public: `SELECT public FROM storage.buckets WHERE id = 'job-uploads'`
- Check CORS configuration
- Verify file path matches convention

## Next Steps
After storage setup:
1. Deploy n8n workflows (see 03-n8n-deployment.md)
2. Test file upload flow from Job Wizard
3. Verify processed outputs are accessible
