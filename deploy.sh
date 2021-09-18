cd /home/rudder-docker

sudo docker rm rudder-server -f
sudo docker build -t rudder-server -f Dockerfile .
sudo docker run -d --name rudder-server --env-file ./env.list -p 3000:3000 rudder-server
