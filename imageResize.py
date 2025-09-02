import boto3
from PIL import Image
import io
from urllib.parse import unquote_plus

s3 = boto3.client('s3')

def lambda_handler(event, context):
    source_bucket = event['Records'][0]['s3']['bucket']['name']
    source_key = unquote_plus(event['Records'][0]['s3']['object']['key'])  
    # print(event)
    destination_bucket = 'abhradippaul-resize-newbucket' # Replace with your bucket

    # Get the image from S3
    obj = s3.get_object(Bucket=source_bucket, Key=source_key)
    image_bytes = obj['Body'].read()

    # Open the image with Pillow
    image = Image.open(io.BytesIO(image_bytes))

    # Define new resolution (e.g., thumbnail size)
    new_width = 200
    new_height = 200
    image.thumbnail((new_width, new_height)) # Resizes proportionally

    # Save the resized image to a buffer
    output_buffer = io.BytesIO()
    image.save(output_buffer, format=image.format)
    output_buffer.seek(0)

    # Upload the resized image to the destination bucket
    s3.put_object(Bucket=destination_bucket, Key=f'resized/{source_key}', Body=output_buffer)

    return {
        'statusCode': 200,
        'body': 'Image resized successfully!'
    }