# cute-grid:jQuery grid plugin

.依赖:
    jQuery1.9+, artTemplate2.0+

.使用方式

    // 初始化
    $('#my-grid').cuteGrid({
        'url' : '{path to get json data}',
        'cols' : [
            {index:'{col.key1}',display:'{列显示名称}',width:'{列宽度}'},
            {index:'{col.key2}',display:'{列显示名称}',width:'{列宽度}',},
            ...
        ]
    });
    -- for detail,look at CuteGrid.fn.defaults and CuteGrid.fn.colsDefaults in cute-grid-1.0.js
    
    
    // 数据协议
    {"result":0,
        "data":{
            "count":47,
            "list":[
                {"{col.key1}":{abc},"{col.key2}":{123},...},
                {"{col.key1}":{def},"{col.key2}":{456},...},
                ...
            ]
        }
    }

.特性列表
    1.支持表头固定，表格体纵向滚动
    2.支持前N列固定，表格体横向滚动
    3.支持表格容器高度自适应，列宽自适应

.开放API列表
    $('#myCuteGrid').cuteGrid('reload')
    $('#myCuteGrid').cuteGrid('reload')
    $('#myCuteGrid').cuteGrid('reload')
    $('#myCuteGrid').cuteGrid('reload')
