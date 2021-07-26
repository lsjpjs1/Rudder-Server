cd /home/rudder-docker
sudo docker build -t rudder-server -f Dockerfile .
sudo docker run -p 3000:3000 rudder-server