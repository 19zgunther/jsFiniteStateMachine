

class StateMachine
{
    constructor(htmlCanvasElement)
    {
        this.states = [];
        this.nameToStateMap = new Map();

        this.currentState = null;

        this.htmlCanvasElement = htmlCanvasElement;
        this.ctx = this.htmlCanvasElement.getContext("2d");

        
        //mouse moving stuff
        this.mouseIsDown = false;
        this.selectedState = null;
        this.movingSelectedState = false;

        this.minimumStateRadius = 10;

        this.resize();

        //this.renderInterval = setInterval(this.render, 40);
    }
    render() {
        const ctx = this.ctx; //this.htmlCanvasElement.getContext('2d');
        ctx.clearRect(0, 0, this.htmlCanvasElement.width, this.htmlCanvasElement.height);
        
        ctx.lineWidth = 1;
        ctx.font = '15px sans-serif';


        //draw all of the states
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            const name = state.name;
            const textRadius = Math.max(Math.ceil((ctx.measureText(name).width+4)/2), this.minimumStateRadius);
            const textHeight = Math.ceil(ctx.measureText(name).actualBoundingBoxAscent);

            state.radius = textRadius;

            ctx.beginPath();
            ctx.arc(state.posX, state.posY, textRadius, 0, Math.PI*2);
            ctx.stroke();
            ctx.textAlign = "center";
            ctx.fillText(name, state.posX, state.posY+textHeight/2);
            ctx.closePath();
        }

        
        //draw all of the edges
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=0; j<state.edges.length; j++)
            {
                const otherState = state.edges[j].otherState;
                if (otherState == state) //check for edge to self
                {
                    //draw arc
                    ctx.beginPath();
                    ctx.arc(state.posX, state.posY + state.radius*2, state.radius*2, -1.1, 4.2);
                    ctx.stroke();
                    ctx.closePath();

                    //now draw the arrow
                    const angle = Math.PI/10;
                    const a2 = angle + Math.PI/3;
                    const a3 = angle - Math.PI/6;
                    const sx = state.posX + state.radius*Math.cos(angle);
                    const sy = state.posY + state.radius*Math.sin(angle);

                    ctx.beginPath();
                    ctx.moveTo(sx + 10*Math.cos(a2), sy + 10*Math.sin(a2))
                    ctx.lineTo( sx, sy );
                    ctx.lineTo( sx + 10*Math.cos(a3), sy + 10*Math.sin(a3) );
                    ctx.stroke();
                    ctx.closePath();
                    

                    continue;
                }
                const angle = Math.atan2(otherState.posY - state.posY, otherState.posX - state.posX);

                const sx = state.posX + state.radius * Math.cos(angle); //sx = start x
                const sy = state.posY + state.radius * Math.sin(angle);
                const ex = otherState.posX - (otherState.radius+3) * Math.cos(angle);
                const ey = otherState.posY - (otherState.radius+3) * Math.sin(angle);

                const a2 = angle + Math.PI/6;
                const a3 = angle - Math.PI/6;

                ctx.beginPath();
                ctx.moveTo(sx, sy); //draw first line
                ctx.lineTo(ex, ey);
                ctx.lineTo(ex - 10*Math.cos(a2), ey - 10*Math.sin(a2)); //now draw arrow ticks
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - 10*Math.cos(a3), ey - 10*Math.sin(a3));
                ctx.stroke();
                ctx.closePath();
            }
        }



        this._adjustStatePositions();
    }
    _adjustStatePositions_OLD(speedMultiplier = 1)
    {
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=i+1; j<this.states.length; j++)
            {
                const otherState = this.states[j];
                const dist = this._distBetweenPoints(state.posX, state.posY, otherState.posX, otherState.posY);
                const angle = Math.atan2(otherState.posY - state.posY, otherState.posX - state.posX);
                const difference = dist - (state.radius + otherState.radius + 100);
                if ( difference < 0  )
                {
                    const movementAmount = Math.min(-difference/10, 5) * speedMultiplier; //difference is negative, so movementAmount is positive
                    state.posX = state.posX - movementAmount * Math.cos(angle);
                    state.posY = state.posY - movementAmount * Math.sin(angle);
                    otherState.posX = otherState.posX + movementAmount * Math.cos(angle);
                    otherState.posY = otherState.posY + movementAmount * Math.sin(angle);
                } else if (difference > 200)
                {
                    const movementAmount = Math.min(difference/300, 5) * speedMultiplier;
                    state.posX = state.posX + movementAmount * Math.cos(angle);
                    state.posY = state.posY + movementAmount * Math.sin(angle);
                    otherState.posX = otherState.posX - movementAmount * Math.cos(angle);
                    otherState.posY = otherState.posY - movementAmount * Math.sin(angle);
                }
            }
        }
    }
    _adjustStatePositions(speedMultiplier = 1)
    {
        //Get all forces acting on states due to proximity to other states
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=i+1; j<this.states.length; j++)
            {
                const otherState = this.states[j];
                const dist = this._distBetweenPoints(state.posX, state.posY, otherState.posX, otherState.posY);
                const angle = Math.atan2(otherState.posY - state.posY, otherState.posX - state.posX);
                const difference = dist - (state.radius + otherState.radius + 100);
                if ( difference < 0  )
                {
                    const movementAmount = Math.min(-difference/10, 5) * speedMultiplier; //difference is negative, so movementAmount is positive
                    state.forceX -= movementAmount * Math.cos(angle);
                    state.forceY -= movementAmount * Math.sin(angle);
                    otherState.forceX += movementAmount * Math.cos(angle);
                    otherState.forceY += movementAmount * Math.sin(angle);
                } else if (difference > 500)
                {
                    const movementAmount = Math.min(difference/300, 5) * speedMultiplier/2;
                    state.forceX += movementAmount * Math.cos(angle);
                    state.forceY += movementAmount * Math.sin(angle);
                    otherState.forceX -= movementAmount * Math.cos(angle);
                    otherState.forceY -= movementAmount * Math.sin(angle);
                }
            }
        }

        //now, apply forces -> velocities -> positions
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];

            if (state == this.selectedState && this.movingSelectedState == true) { 
                state.velocityX = 0;
                state.velocityY = 0;
                state.forceX = 0;
                state.forceY = 0;
                continue; 
            }

            state.velocityX += state.forceX;
            state.velocityY += state.forceY;
            state.forceX = 0;
            state.forceY = 0;
            
            state.posX += state.velocityX/2;
            state.posY += state.velocityY/2;
            state.velocityX -= state.velocityX/10;
            state.velocityY -= state.velocityY/10;

            //node, make sure node is completely within screen
            const r = state.radius * 4;
            state.posX = Math.min(Math.max(state.posX, r), this.htmlCanvasElement.width - r);
            state.posY = Math.min(Math.max(state.posY, r), this.htmlCanvasElement.height - r);

        }
    }
    addState(stateName, posX=Math.random()*this.htmlCanvasElement.width, posY=Math.random()*this.htmlCanvasElement.height)
    {

        //make sure stateName is not already a state
        const res = this.nameToStateMap.get(stateName);
        if (res != null) {
            console.error("StateMachine.addState(): state already exists.");
            return;
        }

        const obj = {
            name: stateName,
            edges: [], // in form of objects {otherStateName, edgeName}

            radius: 0, //used for rendering
            posX: posX,
            posY: posY,
            velocityX: 0,
            velocityY: 0,
            forceX: 0,
            forceY: 0,
        }

        this.states.push(obj);
        this.nameToStateMap.set(stateName, obj);
    }
    removeState(stateName)
    {
        //remove from state Array, and from stateObjects
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            if (state.name == stateName)
            {
                this.states.splice(i, 1);
                continue;
            }

            //remove from edges
            const edges = state.edges;
            for (let j=0; j<edges.length; j++)
            {
                if ( edges[j].otherStateName == stateName )
                {
                    edges.splice(j, 1);
                }
            }
        }

        //remove from nameToStateMap
        this.nameToStateMap.set(stateName, null);
    }
    addEdge(state1Name, state2Name, edgeName)
    {
        if (state1Name == undefined || state1Name == null || state2Name == undefined || state2Name == null || edgeName == undefined || edgeName == null) {
            console.error("StateMachine.addEdge(): Cannot add edge with undefined state1Name, state2Name, or edgeName");
            return;
        }

        //create the states if not already exist
        let state1 = this.nameToStateMap.get(state1Name);
        if (state1 == null)
        {
            this.addState(state1Name);
            state1 = this.nameToStateMap.get(state1Name);
        }

        let state2 = this.nameToStateMap.get(state2Name);
        if (state2 == null)
        {
            this.addState(state2Name);
            state2 = this.nameToStateMap.get(state2Name);
        }

        //Now, we have 2 states & stateNames, and an edgeName
        state1.edges.push({
            otherState: state2,
            edgeName: edgeName,
        });
    }
    removeEdge(state1Name, state2Name, edgeName)
    {
        let state1 = this.nameToStateMap.get(state1Name);
        if (state1 == null)
        {
            console.error("StateMachine.removeEdge(): cannot remove edge from state that DNE");
            return;
        }

        //remove edge from state1.edges;
        const edges = state1.edges;
        for (let i=0; i<edges.length; i++)
        {
            if (edges[i].otherState.name == state2Name && edges[i].edgeName == edgeName) //not checking state1Name, because those shouldn't be necessary... may remove them later
            {
                edges.splice(i, 1);
            }
        }
    }
    _distBetweenPoints(x1, y1, x2, y2)
    {

        return Math.sqrt( Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2) );
    }
    loadMachine(code='node1,node2,edge1,')
    {
        /*code.replace(/(\r\n|\n|\r)/gm, "");
        code.replace(' ', '');
        code.replace(/\s/g, '');
        code.replace('\r', '');*/
        let newCode = '';
        for (let i=0; i<code.length; i++)
        {
            const c = code[i];
            if (!(c == '\n' || c=='\r' || c==' '))
            {
                newCode += c;
            }
        }
        
        //console.log(newCode);
        const list = newCode.split(',');
        for (let i=0; i<list.length-2; i+=3)
        {
            const s1 = list[i  ];
            const s2 = list[i+1];
            const e  = list[i+2];
            if (s1 == null || s2 == null || e == null)
            {
                console.error("StateMachine.loadMachine(): Attemped to add state or edge with null name");
                continue;
            }
            if (s1.length < 1 || s2.length < 1 || e.length < 1)
            {
                console.error("StateMachine.loadMachine(): Attemped to add state or edge with name length < 1");
                continue;
            }
            this.addEdge(s1,s2,e);
        }
    }
    resize() {
        
        const bb = this.htmlCanvasElement.getBoundingClientRect();
        this.htmlCanvasElement.width = Math.round(bb.width);
        this.htmlCanvasElement.height = Math.round(bb.height);
        //this.ctx = this.htmlCanvasElement.getContext("2d");
    }
    eventListener(event) {
        //console.log(event);
        let mx = 0;
        let my = 0;
        switch(event.type)
        {
            case 'mousedown': 
                this.mouseIsDown = true;
                mx = event.offsetX;
                my = event.offsetY;
                for (let i=0; i<this.states.length; i++)
                {
                    const dist = this._distBetweenPoints(mx,my, this.states[i].posX, this.states[i].posY);
                    if (dist < this.states[i].radius)
                    {
                        this.selectedState = this.states[i];
                        this.movingSelectedState = true;
                    }
                }
                break;
            case 'mouseup': 
                this.mouseIsDown = false;
                this.movingSelectedState = false;
                break;
            case 'mouseout': 
                this.mouseIsDown = false;
                this.movingSelectedState = false;
                break;
            case 'mousemove': 
                mx = event.offsetX;
                my = event.offsetY;
                if (this.mouseIsDown == true && this.movingSelectedState == true)
                {
                    this.selectedState.posX = mx;
                    this.selectedState.posY = my;
                }
                break;

        }
    }
}




{

    const canvas = document.getElementById("testCanvas");
    const sm = new StateMachine(canvas);
    ['mousedown', 'mouseup', 'mousemove', 'mouseout', 'onhover'].forEach(function(eventType)
    {
        canvas.addEventListener(eventType, function(e) {
            sm.eventListener(e);
        })
    })


    //randomly generate new fsm & load it
    let text = '';
    let possibleStates = ['a234567890','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
    for (let i=0; i<10; i++)
    {
        text += possibleStates[Math.floor(Math.random() * possibleStates.length)] +','+possibleStates[Math.floor(Math.random() * possibleStates.length)]+','+'1,'; 
    }
    console.log(text)
    sm.loadMachine(text);


    let interval = setInterval(update, 30);

    function update() {
        sm.render();
    }

    

}