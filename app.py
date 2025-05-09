from flask import Flask, request, render_template, jsonify, send_file, url_for
from flask import Response
import boto3
import base64
import uuid
import os
import json
from io import BytesIO
import random  # Simulate data processing
import requests
import logging
import pandas as pd

from trainModel import lastChanceForRedemption as lr
app = Flask(__name__)

# Basic configuration for logging
logging.basicConfig(level=logging.INFO)  # This will log all levels of messages (DEBUG and higher)
# Initialize AWS clients
polly = boto3.client('polly')
transcribe = boto3.client('transcribe')
s3 = boto3.client('s3')
S3_BUCKET = 'your-temp-audio-bucket'
REGION = 'us-east-1'

def get_message(key):
    # Get absolute path for the file inside static/data
    file_path = os.path.join(app.root_path, "static", "data", "messages.json")
    with open(file_path, "r") as file:
        messages = json.load(file)
    return messages.get(key, "Default message")  # Return default if key not found

#@app.route('/audio/<filename>/<message>')
@app.route('/audio/<filename>')
def serve_audio(filename):
    key = request.args.get('key', filename + '_mesg')  # Get key from request (default: welcome)
    message = get_message(key)
    generate_audio(message, filename)
    audioPath = 'static/audio/' + filename + '.mp3'
    return send_file(audioPath, mimetype='audio/mp3')

@app.route('/')
def index():
    # audio_url = url_for('serve_audio', filename='example') # fetch the file dynamically, need to do likewise with the text that needs converting
    return render_template('index.html')

@app.route('/history')
def history():
   return render_template('History.html')


@app.route('/forecast', methods=["GET", "POST"])
def forecast():
    forecast_html = None
    location = None

    if request.method == "POST":
        location = request.form["location"].strip()

        try:
            forecast_dict = lr.predict_seven_day_forecast(location)  # You handle ZIP/city inside here

            df = pd.DataFrame(forecast_dict)
            df.index = [f"Day {i+1}" for i in range(len(df))]
            forecast_html = df.to_html(classes="table table-bordered table-striped", border=0)

        except Exception as e:
            forecast_html = f"<p style='color:red;'>Error: {e}</p>"
    return render_template('Forecast.html', forecast_table=forecast_html, location=location)
    

@app.route('/analytics')
def analytics():
    return render_template('Analytics.html')

###### history.html links

@app.route('/weatheranomaliesbystate.html')
def weatherAnomaliesbyState():
    return render_template('WeatherAnomaliesbyState.html')

@app.route('/globaltrendsarima.html')
def globalTrend():
    return render_template('GlobalTrendSARIMA.html')

@app.route('/us30deadliestweatherdisasters.html')
def us30Deadliest():
    return render_template('US30DeadliestWeatherDisasters.html')

@app.route('/occurenceofanomalies.html')
def occurenceofanomalies():
    return render_template('OccurenceofAnomalies.html')

@app.route('/sarimabyyear.html')
def SARIMAbyYear():
    return render_template('SARIMAbyYear.html')

@app.route('/economicimpactweatherdisasters.html')
def economicImpact():
    return render_template('EconomicImpactWeatherDisasters.html')


###### forecast.html links

@app.route('/weatherthisweek.html')
def weatherThisWeek():
    return render_template('WeatherThisWeek.html')

@app.route('/shareweatherexperiences.html')
def shareWeatherExperiences():
    return render_template('ShareWeatherExperiences.html')

@app.route('/weathertrivia.html')
def weatherTrivia():
    return render_template('WeatherTrivia.html')


###### analytics.html links

@app.route('/usclimatefeatures.html')
def usClimateFeatures():
    
    return render_template('USClimateFeatures.html')

@app.route('/clustering.html')
def clustering():
    
    return render_template('Clustering.html')

@app.route('/graphhierarchies.html')
def graphHierarchies():
    
    return render_template('GraphHierarchies.html')

@app.route('/futurework.html')
def futurework():
    
    return render_template('FutureWork.html')

###########


def generate_audio(text, file_path):
    file_path = os.path.join('app/static', 'audio', f'{file_path}.mp3')
    if not os.path.exists(file_path):
        response = polly.synthesize_speech(
            Text = text,
            OutputFormat = 'mp3',
            VoiceId='Joanna'
        )
        with open(file_path, 'wb') as file:
            file.write(response['AudioStream'].read())
    return file_path


@app.route('/predict', methods=['POST'])
def predict():
    # Basic configuration for logging
    app.logger.debug("Entering the in /predict route") 
    # Simulating data processing (Replace with actual Random Forest prediction logic)
    data = {
        'temperature': random.randint(20, 30),  # Random temperature for simulation
        'rainfall': random.randint(0, 100),     # Random rainfall for simulation
    }

    # Text for AWS Polly to synthesize
    text = f"The predicted temperature is {data['temperature']} degrees Celsius. Rainfall is {data['rainfall']} millimeters."

    # Convert the prediction text to speech (using AWS Polly)
    audio_stream = synthesize_speech(text)

    '''# Return prediction and audio data
    return jsonify({
        'data': data,
        'audio': audio_stream
    })'''
    return audio_stream

def synthesize_speech(text):
    app.logger.debug('trying to synthesized the speech')
    try:
        response = polly.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId='Joanna'  # You can change the voice
        )
        if 'AudioStream' in response:
            with open('speech.mp3', 'wb') as audio_file:
                audio_file.write(response['AudioStream'].read())
        else:
            print("Error: No audio stream received.")

        # Get audio stream and encode it in base64
        audio_stream = response['AudioStream'].read()
        # audio_base64 = base64.b64encode(audio_stream).decode('utf-8')
        # Send the audio back as a response
        return Response(audio_stream, mimetype='audio/mpeg')
        # return audio_base64

    except Exception as e:
        print("Error synthesizing speech:", e)
        return None


@app.route('/api/voice-query', methods=['POST'])
def voice_query():
    audio = request.files['audio']
    file_id = str(uuid.uuid4())
    audio_file_name = f"{file_id}.webm"
    audio_path = f"/tmp/{audio_file_name}"
    
    audio.save(audio_path)

    # Upload to S3
    s3.upload_file(audio_path, S3_BUCKET, audio_file_name)

    transcribe_job_name = f"job-{file_id}"
    transcribe.start_transcription_job(
        TranscriptionJobName=transcribe_job_name,
        Media={"MediaFileUri": f"s3://{S3_BUCKET}/{audio_file_name}"},
        MediaFormat='webm',
        LanguageCode='en-US'
    )

    # Wait for the job to complete (polling for demo simplicity)
    import time
    while True:
        status = transcribe.get_transcription_job(TranscriptionJobName=transcribe_job_name)
        if status['TranscriptionJob']['TranscriptionJobStatus'] in ['COMPLETED', 'FAILED']:
            break
        time.sleep(1)

    if status['TranscriptionJob']['TranscriptionJobStatus'] == 'FAILED':
        return jsonify({'error': 'Transcription failed'}), 500

    transcript_url = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
    import requests
    transcript = requests.get(transcript_url).json()['results']['transcripts'][0]['transcript']

    # Dummy prediction from preexisting model or API
    prediction_result = f"You said: {transcript}. Weather tomorrow is sunny with 22 degrees."

    # Polly speech synthesis
    polly_response = polly.synthesize_speech(
        Text=prediction_result,
        OutputFormat='mp3',
        VoiceId='Joanna'
    )
    audio_stream = polly_response['AudioStream'].read()
    audio_b64 = base64.b64encode(audio_stream).decode('utf-8')

    return jsonify({
        'transcript': transcript,
        'prediction': prediction_result,
        'audio': audio_b64
    })


@app.route('/synthesize', methods=['GET'])
def synthesize():
    app.logger.info('in syntheszie which is called form SpeakText')
    text = request.args.get('text', 'Hello hello from AWS Polly from Jennifer')
    response = polly.synthesize_speech(Text=text, OutputFormat='mp3', VoiceId='Joanna')
    audio_stream = response['AudioStream'].read()
    return Response(audio_stream, mimetype='audio/mpeg')

@app.route('/voice')
def voice_page():
    app.logger.info('in voice_page')
    return render_template('voice.html')



def get_weather_forecast(city):
    app.logger.info('in get_weather_forecast')
    # Replace this with a real API call
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid=YOUR_OPENWEATHERMAP_KEY&units=metric"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        temp = data["main"]["temp"]
        condition = data["weather"][0]["description"]
        return f"The weather in {city} is {condition} with a temperature of {temp:.1f} degrees Celsius."
    return f"Sorry, I couldn't get the weather for {city}."

@app.route('/weather')
def weather_page():
    return render_template('weather.html')

@app.route('/get_ext_weather', methods=['POST'])
def get_weatherr():
    location_type = request.form['locationType']
    if location_type == 'zip':
        location = request.form['zipcode']
        message = f"The weather for ZIP code {location} is sunny and 72 degrees."
    elif location_type == 'state':
        location = request.form['state']
        message = f"The weather in {location} is cloudy with a chance of rain."
    else:
        message = "Invalid location type."

    # Call AWS Polly to synthesize the message
    polly = boto3.client('polly')
    response = polly.synthesize_speech(Text=message, OutputFormat='mp3', VoiceId='Joanna')

   # Ensure 'audio' directory exists
    
    os.makedirs('app/static/audio', exist_ok=True)
    audio_path = os.path.join('app/static', 'audio', 'weather_response.mp3')
    if 'AudioStream' in response:
            with open(audio_path, 'wb') as audio_file:
                audio_file.write(response['AudioStream'].read())
    else:
            print("Error: No audio stream received.")
    

    return render_template('weather_result.html', message=message)

@app.route("/speak-weather")
def speak_weather():
    city = request.args.get("city", "")
    forecast_text = get_weather_forecast(city)

    response = polly.synthesize_speech(
        Text=forecast_text,
        OutputFormat="mp3",
        VoiceId="Joanna"
    )
    return Response(response["AudioStream"].read(), mimetype="audio/mp3")

if __name__ == '__main__':
    app.run(debug=True)


