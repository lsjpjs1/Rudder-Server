cd /home/rudder-docker

sudo docker rm rudder-server
sudo docker build -t rudder-server -f Dockerfile .
sudo docker run --name rudder-server -p 3000:3000 rudder-server