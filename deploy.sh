cd /home/rudder-docker


sudo docker build -t rudder-server -f Dockerfile .
sudo docker run --name rudder-server --env-file ./env.list -p 3000:3000 rudder-server